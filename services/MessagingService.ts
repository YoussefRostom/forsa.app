import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  limitToLast,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { resolveUserDisplayName as resolveCanonicalDisplayName } from '../lib/userDisplayName';
import { isTransientNotificationDispatchError } from './NotificationService';
import { sendPushNotificationsToUsers } from './PushNotificationService';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl?: string;
  isRead: boolean;
  createdAt: any; // Firestore Timestamp
  senderName?: string;
  senderPhoto?: string;
}

export interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  participant1Name?: string;
  participant2Name?: string;
  participant1Photo?: string;
  participant2Photo?: string;
  participant1Role?: string;
  participant2Role?: string;
  lastMessage?: string;
  lastMessageAt?: any;
  lastMessageSenderId?: string;
  unreadCount?: number;
  createdAt: any;
  otherParticipantId?: string;
  otherParticipantName?: string;
  otherParticipantPhoto?: string;
  otherParticipantRole?: string;
}

const inFlightConversationRequests = new Map<string, Promise<string>>();
const unreadCountCache = new Map<string, { value: number; fetchedAt: number }>();
const UNREAD_COUNT_CACHE_MS = 15000;
const LIVE_MESSAGES_WINDOW_SIZE = 150;
const readReceiptInFlight = new Set<string>();
const userPreviewCache = new Map<string, { fetchedAt: number; profile: { name: string; photo?: string; role?: string } }>();
let currentUserChatProfileCache:
  | { userId: string; fetchedAt: number; profile: { name: string; photo: string | null; role: string | null } }
  | null = null;
const CHAT_PROFILE_CACHE_MS = 60000;

async function getUserPreview(userId?: string): Promise<{ name: string; photo?: string; role?: string } | null> {
  if (!userId) {
    return null;
  }

  const now = Date.now();
  const cached = userPreviewCache.get(userId);
  if (cached && now - cached.fetchedAt < CHAT_PROFILE_CACHE_MS) {
    return cached.profile;
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) {
      return null;
    }

    const userData = userSnap.data();
    const profile = {
      name: resolveCanonicalDisplayName(userData),
      photo: userData?.profilePhoto || userData?.photoURL || userData?.profileImage || userData?.image || userData?.photo || undefined,
      role: String(userData?.role || '').trim() || undefined,
    };

    userPreviewCache.set(userId, { fetchedAt: now, profile });
    return profile;
  } catch {
    return null;
  }
}

/**
 * Generate a consistent conversation ID from two user IDs
 * Ensures the same conversation ID regardless of which user initiates
 */
function getConversationId(userId1: string, userId2: string): string {
  // Sort IDs to ensure consistency
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

function resolveAuthDisplayName(currentUser: typeof auth.currentUser): string {
  const authDisplayName = currentUser?.displayName?.trim();
  return authDisplayName || 'You';
}

function getImmediateCurrentUserChatProfile() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  if (currentUserChatProfileCache?.userId === currentUser.uid) {
    return currentUserChatProfileCache.profile;
  }

  return {
    name: resolveAuthDisplayName(currentUser),
    photo: currentUser.photoURL || null,
    role: null,
  };
}

async function getCurrentUserChatProfile() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  const now = Date.now();
  if (
    currentUserChatProfileCache &&
    currentUserChatProfileCache.userId === currentUser.uid &&
    now - currentUserChatProfileCache.fetchedAt < CHAT_PROFILE_CACHE_MS
  ) {
    return currentUserChatProfileCache.profile;
  }

  try {
    const currentUserSnap = await getDoc(doc(db, 'users', currentUser.uid));
    const userData = currentUserSnap.exists() ? currentUserSnap.data() : null;
    const profile = {
      name: userData ? resolveCanonicalDisplayName(userData) : resolveAuthDisplayName(currentUser),
      photo: userData?.profilePhoto || currentUser.photoURL || null,
      role: String(userData?.role || '').trim() || null,
    };
    currentUserChatProfileCache = {
      userId: currentUser.uid,
      fetchedAt: now,
      profile,
    };
    return profile;
  } catch {
    const profile = {
      name: resolveAuthDisplayName(currentUser),
      photo: currentUser.photoURL || null,
      role: null,
    };
    currentUserChatProfileCache = {
      userId: currentUser.uid,
      fetchedAt: now,
      profile,
    };
    return profile;
  }
}

export function warmCurrentUserChatProfile(): void {
  void getCurrentUserChatProfile().catch(() => {
    // Ignore background warm-up failures; send path has a synchronous fallback.
  });
}

function applyConversationParticipantPreview(conversation: Conversation): Conversation {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) {
    return conversation;
  }

  const otherIsParticipant1 = conversation.participant1Id === conversation.otherParticipantId;
  const fallbackName = otherIsParticipant1 ? conversation.participant1Name : conversation.participant2Name;
  const fallbackPhoto = otherIsParticipant1 ? conversation.participant1Photo : conversation.participant2Photo;
  const fallbackRole = otherIsParticipant1 ? conversation.participant1Role : conversation.participant2Role;

  if (!conversation.otherParticipantName && fallbackName) {
    conversation.otherParticipantName = fallbackName;
  }
  if (!conversation.otherParticipantPhoto && fallbackPhoto) {
    conversation.otherParticipantPhoto = fallbackPhoto;
  }
  if (!conversation.otherParticipantRole && fallbackRole) {
    conversation.otherParticipantRole = fallbackRole;
  }

  return conversation;
}

function getTimestampMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function shouldHydrateConversationPreview(conversation: Conversation): boolean {
  return (!conversation.lastMessage && !conversation.lastMessageAt)
    || !conversation.otherParticipantName
    || !conversation.otherParticipantPhoto;
}

async function getUnreadCountForConversation(
  conversationId: string,
  currentUserId: string,
  forceRefresh: boolean = false
): Promise<number> {
  const cached = unreadCountCache.get(conversationId);
  const now = Date.now();

  if (!forceRefresh && cached && now - cached.fetchedAt < UNREAD_COUNT_CACHE_MS) {
    return cached.value;
  }

  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const unreadQuery = query(messagesRef, where('isRead', '==', false));
    const unreadSnap = await getDocs(unreadQuery);
    const unreadCount = unreadSnap.docs.filter((docSnap) => docSnap.data().senderId !== currentUserId).length;
    unreadCountCache.set(conversationId, { value: unreadCount, fetchedAt: now });
    return unreadCount;
  } catch (error) {
    console.error('Error calculating unread count:', error);
    return 0;
  }
}

async function enrichConversation(
  conversation: Conversation,
  currentUserId: string,
  forceUnreadRefresh: boolean = false
): Promise<Conversation> {
  applyConversationParticipantPreview(conversation);

  if (shouldHydrateConversationPreview(conversation)) {
    await hydrateConversationPreview(conversation);
  }

  if ((!conversation.otherParticipantName || !conversation.otherParticipantPhoto || !conversation.otherParticipantRole) && conversation.otherParticipantId) {
    const profile = await getUserPreview(conversation.otherParticipantId);
    if (profile) {
      conversation.otherParticipantName = conversation.otherParticipantName || profile.name;
      conversation.otherParticipantPhoto = conversation.otherParticipantPhoto || profile.photo;
      conversation.otherParticipantRole = conversation.otherParticipantRole || profile.role;
    }
  }

  conversation.unreadCount = await getUnreadCountForConversation(
    conversation.id,
    currentUserId,
    forceUnreadRefresh
  );

  return conversation;
}

async function hydrateConversationPreview(conversation: Conversation): Promise<Conversation> {
  try {
    const recentMessagesQuery = query(
      collection(db, 'conversations', conversation.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const recentMessagesSnap = await getDocs(recentMessagesQuery);
    if (recentMessagesSnap.empty) {
      return conversation;
    }

    const recentMessages = recentMessagesSnap.docs.map((docSnap) => docSnap.data());
    const latestMessageData = recentMessages[0];
    const latestMessageText = String(latestMessageData.content || '').trim() || (latestMessageData.mediaUrl ? 'Media' : '');
    const latestMessageAt = latestMessageData.createdAt || conversation.lastMessageAt || conversation.createdAt;
    const latestMessageAtMs = getTimestampMillis(latestMessageAt);
    const currentPreviewAtMs = getTimestampMillis(conversation.lastMessageAt || conversation.createdAt);

    if (!conversation.lastMessage || latestMessageAtMs >= currentPreviewAtMs) {
      conversation.lastMessage = latestMessageText;
      conversation.lastMessageAt = latestMessageAt;
      conversation.lastMessageSenderId = latestMessageData.senderId || conversation.lastMessageSenderId;

      if (latestMessageData.senderId === conversation.otherParticipantId) {
        conversation.otherParticipantName = latestMessageData.senderName || conversation.otherParticipantName;
        conversation.otherParticipantPhoto = latestMessageData.senderPhoto || conversation.otherParticipantPhoto;
      }
    }

    if (!conversation.otherParticipantName || !conversation.otherParticipantPhoto) {
      const latestMessageFromOtherUser = recentMessages.find(
        (messageData) => messageData.senderId === conversation.otherParticipantId
      );

      if (latestMessageFromOtherUser) {
        conversation.otherParticipantName = latestMessageFromOtherUser.senderName || conversation.otherParticipantName;
        conversation.otherParticipantPhoto = latestMessageFromOtherUser.senderPhoto || conversation.otherParticipantPhoto;
      }
    }
  } catch (error) {
    console.warn('Failed to hydrate conversation preview:', error);
  }

  return applyConversationParticipantPreview(conversation);
}

/**
 * Get or create a conversation between two users
 */
export async function getOrCreateConversation(
  otherUserId: string
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  const conversationId = getConversationId(currentUser.uid, otherUserId);
  const existingRequest = inFlightConversationRequests.get(conversationId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const currentProfile = await getCurrentUserChatProfile();

    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);

    if (conversationSnap.exists()) {
      return conversationId;
    }

    // Create new conversation
    const participant1Id = currentUser.uid < otherUserId 
      ? currentUser.uid 
      : otherUserId;
    const participant2Id = currentUser.uid < otherUserId 
      ? otherUserId 
      : currentUser.uid;

    await setDoc(doc(db, 'conversations', conversationId), {
      participant1Id,
      participant2Id,
      participant1Name: participant1Id === currentUser.uid ? currentProfile.name : null,
      participant1Photo: participant1Id === currentUser.uid ? currentProfile.photo : null,
      participant1Role: participant1Id === currentUser.uid ? currentProfile.role : null,
      participant2Name: participant2Id === currentUser.uid ? currentProfile.name : null,
      participant2Photo: participant2Id === currentUser.uid ? currentProfile.photo : null,
      participant2Role: participant2Id === currentUser.uid ? currentProfile.role : null,
      createdAt: serverTimestamp(),
      lastMessageAt: null,
    });

    return conversationId;
  })();

  inFlightConversationRequests.set(conversationId, request);

  try {
    return await request;
  } catch (error: any) {
    console.error('Error getting/creating conversation:', error);
    throw error;
  } finally {
    inFlightConversationRequests.delete(conversationId);
  }
}

/**
 * Find any admin user ID (returns first found). Used for users to message admin.
 */
export async function findAdminUserId(): Promise<string | null> {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'admin'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
    // try uppercase role
    const q2 = query(collection(db, 'users'), where('role', '==', 'ADMIN'), limit(1));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return snap2.docs[0].id;
    return null;
  } catch (error) {
    console.error('Error finding admin user:', error);
    return null;
  }
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  mediaUrl?: string
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  if (!content.trim() && !mediaUrl) {
    throw new Error('Message content or media is required');
  }

  try {
    const trimmedContent = content.trim();
    const currentProfile = getImmediateCurrentUserChatProfile();
    warmCurrentUserChatProfile();
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const conversationRef = doc(db, 'conversations', conversationId);
    const [participant1Id, participant2Id] = conversationId.split('_');
    const messageData: any = {
      senderId: currentUser.uid,
      content: trimmedContent || '',
      senderName: currentProfile.name,
      senderPhoto: currentProfile.photo,
      isRead: false,
      createdAt: serverTimestamp(),
    };

    if (mediaUrl) {
      messageData.mediaUrl = mediaUrl;
    }

    const messageRef = await addDoc(messagesRef, messageData);
    const messageId = messageRef.id;

    const conversationUpdates: any = {
      lastMessage: trimmedContent || (mediaUrl ? 'Media' : ''),
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: currentUser.uid,
    };

    const fallbackConversationData = {
      participant1Id,
      participant2Id,
      createdAt: serverTimestamp(),
      participant1Name: participant1Id === currentUser.uid ? currentProfile.name : null,
      participant1Photo: participant1Id === currentUser.uid ? currentProfile.photo : null,
      participant1Role: participant1Id === currentUser.uid ? currentProfile.role : null,
      participant2Name: participant2Id === currentUser.uid ? currentProfile.name : null,
      participant2Photo: participant2Id === currentUser.uid ? currentProfile.photo : null,
      participant2Role: participant2Id === currentUser.uid ? currentProfile.role : null,
    };

    const conversationBaseData: any = {
      participant1Id,
      participant2Id,
      createdAt: serverTimestamp(),
    };

    if (participant1Id === currentUser.uid) {
      conversationUpdates.participant1Name = currentProfile.name;
      conversationUpdates.participant1Photo = currentProfile.photo;
      conversationUpdates.participant1Role = currentProfile.role;
    } else if (participant2Id === currentUser.uid) {
      conversationUpdates.participant2Name = currentProfile.name;
      conversationUpdates.participant2Photo = currentProfile.photo;
      conversationUpdates.participant2Role = currentProfile.role;
    }

    await setDoc(
      conversationRef,
      { ...conversationBaseData, ...conversationUpdates },
      { merge: true }
    );

    const conversationSnap = await getDoc(conversationRef);
    const conversationData = conversationSnap.exists() ? (conversationSnap.data() as any) : null;
    const conversationParticipant1Id = typeof conversationData?.participant1Id === 'string'
      ? conversationData.participant1Id
      : participant1Id;
    const conversationParticipant2Id = typeof conversationData?.participant2Id === 'string'
      ? conversationData.participant2Id
      : participant2Id;
    const otherUserId = conversationParticipant1Id === currentUser.uid
      ? conversationParticipant2Id
      : conversationParticipant1Id;

    if (otherUserId && otherUserId !== currentUser.uid) {
      void (async () => {
        try {
          const otherRole = conversationData
            ? String(
                conversationParticipant1Id === otherUserId
                  ? conversationData.participant1Role || ''
                  : conversationData.participant2Role || ''
              ).toLowerCase()
            : '';
          const notificationRoute = otherRole === 'admin' ? '/(admin)/notifications' : '/notifications';

          await sendPushNotificationsToUsers(
            [otherUserId],
            `New message from ${currentProfile.name}`,
            trimmedContent || 'Sent a message',
            {
              senderId: currentUser.uid,
              conversationId,
              notificationKind: 'chat',
              route: notificationRoute,
            }
          );
        } catch (err) {
          if (!isTransientNotificationDispatchError(err)) {
            console.warn('Failed to create message notification:', err);
          }
        }
      })();
    }

    return messageId;
  } catch (error: any) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Get all conversations for the current user
 */
export async function getConversations(): Promise<Conversation[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  try {
    const conversationsRef = collection(db, 'conversations');
    // Remove orderBy to avoid index requirement - we'll sort client-side
    const q = query(
      conversationsRef,
      where('participant1Id', '==', currentUser.uid)
    );

    const q2 = query(
      conversationsRef,
      where('participant2Id', '==', currentUser.uid)
    );

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q),
      getDocs(q2)
    ]);

    const conversations: Conversation[] = [];

    // Process conversations where user is participant1
    snapshot1.forEach((docSnap) => {
      const data = docSnap.data();
      conversations.push({
        id: docSnap.id,
        participant1Id: data.participant1Id,
        participant2Id: data.participant2Id,
        participant1Name: data.participant1Name,
        participant2Name: data.participant2Name,
        participant1Photo: data.participant1Photo,
        participant2Photo: data.participant2Photo,
        participant1Role: data.participant1Role,
        participant2Role: data.participant2Role,
        lastMessage: data.lastMessage,
        lastMessageAt: data.lastMessageAt,
        lastMessageSenderId: data.lastMessageSenderId,
        createdAt: data.createdAt,
        otherParticipantId: data.participant2Id,
      });
    });

    // Process conversations where user is participant2
    snapshot2.forEach((docSnap) => {
      const data = docSnap.data();
      conversations.push({
        id: docSnap.id,
        participant1Id: data.participant1Id,
        participant2Id: data.participant2Id,
        participant1Name: data.participant1Name,
        participant2Name: data.participant2Name,
        participant1Photo: data.participant1Photo,
        participant2Photo: data.participant2Photo,
        participant1Role: data.participant1Role,
        participant2Role: data.participant2Role,
        lastMessage: data.lastMessage,
        lastMessageAt: data.lastMessageAt,
        lastMessageSenderId: data.lastMessageSenderId,
        createdAt: data.createdAt,
        otherParticipantId: data.participant1Id,
      });
    });

    // Sort by lastMessageAt (most recent first)
    conversations.sort((a, b) => {
      const timeA = getTimestampMillis(a.lastMessageAt || a.createdAt);
      const timeB = getTimestampMillis(b.lastMessageAt || b.createdAt);
      return timeB - timeA;
    });

    const enrichedConversations = await Promise.all(
      conversations.map((conv) => enrichConversation(conv, currentUser.uid))
    );

    return enrichedConversations;
  } catch (error: any) {
    console.error('Error getting conversations:', error);
    throw error;
  }
}

/**
 * Subscribe to conversations list with real-time updates
 */
export function subscribeToConversations(
  callback: (conversations: Conversation[]) => void
): () => void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  const conversationsRef = collection(db, 'conversations');
  // Remove orderBy to avoid index requirement - we'll sort client-side
  const q1 = query(
    conversationsRef,
    where('participant1Id', '==', currentUser.uid)
  );

  const q2 = query(
    conversationsRef,
    where('participant2Id', '==', currentUser.uid)
  );

  let conversations: Conversation[] = [];
  let processVersion = 0;
  let processScheduled = false;

  const processConversations = async () => {
    const version = ++processVersion;
    const conversationSnapshot = [...conversations];
    const enriched = await Promise.all(
      conversationSnapshot.map((conv) => enrichConversation(conv, currentUser.uid))
    );

    if (version !== processVersion) {
      return;
    }

    enriched.sort((a, b) => {
      const timeA = getTimestampMillis(a.lastMessageAt || a.createdAt);
      const timeB = getTimestampMillis(b.lastMessageAt || b.createdAt);
      return timeB - timeA;
    });

    callback(enriched);
  };

  const scheduleProcessConversations = () => {
    if (processScheduled) {
      return;
    }

    processScheduled = true;
    Promise.resolve().then(() => {
      processScheduled = false;
      processConversations().catch((error) => {
        console.error('Error processing conversations:', error);
      });
    });
  };

  const unsubscribe1 = onSnapshot(q1, (snapshot) => {
    // Update conversations array - keep all existing conversations and update/add new ones
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const existingIndex = conversations.findIndex(c => c.id === docSnap.id);
      const conv: Conversation = {
        id: docSnap.id,
        participant1Id: data.participant1Id,
        participant2Id: data.participant2Id,
        participant1Name: data.participant1Name,
        participant2Name: data.participant2Name,
        participant1Photo: data.participant1Photo,
        participant2Photo: data.participant2Photo,
        participant1Role: data.participant1Role,
        participant2Role: data.participant2Role,
        lastMessage: data.lastMessage,
        lastMessageAt: data.lastMessageAt,
        lastMessageSenderId: data.lastMessageSenderId,
        createdAt: data.createdAt,
        otherParticipantId: data.participant2Id,
      };
      
      if (existingIndex >= 0) {
        conversations[existingIndex] = conv;
      } else {
        conversations.push(conv);
      }
    });
    
    // Remove conversations that no longer exist in this query
    const snapshotIds = new Set(snapshot.docs.map(doc => doc.id));
    conversations = conversations.filter(c => 
      c.participant1Id === currentUser.uid ? snapshotIds.has(c.id) : true
    );
    
    scheduleProcessConversations();
  });

  const unsubscribe2 = onSnapshot(q2, (snapshot) => {
    // Update conversations array - keep all existing conversations and update/add new ones
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const existingIndex = conversations.findIndex(c => c.id === docSnap.id);
      const conv: Conversation = {
        id: docSnap.id,
        participant1Id: data.participant1Id,
        participant2Id: data.participant2Id,
        participant1Name: data.participant1Name,
        participant2Name: data.participant2Name,
        participant1Photo: data.participant1Photo,
        participant2Photo: data.participant2Photo,
        participant1Role: data.participant1Role,
        participant2Role: data.participant2Role,
        lastMessage: data.lastMessage,
        lastMessageAt: data.lastMessageAt,
        lastMessageSenderId: data.lastMessageSenderId,
        createdAt: data.createdAt,
        otherParticipantId: data.participant1Id,
      };
      
      if (existingIndex >= 0) {
        conversations[existingIndex] = conv;
      } else {
        conversations.push(conv);
      }
    });
    
    // Remove conversations that no longer exist in this query
    const snapshotIds = new Set(snapshot.docs.map(doc => doc.id));
    conversations = conversations.filter(c => 
      c.participant2Id === currentUser.uid ? snapshotIds.has(c.id) : true
    );
    
    scheduleProcessConversations();
  });

  return () => {
    unsubscribe1();
    unsubscribe2();
  };
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  limitCount: number = 50
): Promise<Message[]> {
  try {
    const currentUserId = auth.currentUser?.uid;
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const messages: Message[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      messages.push({
        id: docSnap.id,
        conversationId,
        senderId: data.senderId,
        content: data.content || '',
        mediaUrl: data.mediaUrl,
        senderName: data.senderName,
        senderPhoto: data.senderPhoto,
        isRead: data.isRead || false,
        createdAt: data.createdAt,
      });
    });

    // Reverse to show oldest first
    messages.reverse();

    messages.forEach((msg) => {
      if (!msg.senderName) {
        msg.senderName = msg.senderId === currentUserId ? getImmediateCurrentUserChatProfile().name : 'Unknown';
      }
      msg.senderPhoto = msg.senderPhoto || undefined;
    });

    return messages;
  } catch (error: any) {
    console.error('Error getting messages:', error);
    throw error;
  }
}

/**
 * Subscribe to messages in a conversation with real-time updates
 */
export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void,
  onError?: (error: any) => void
): () => void {
  const currentUserId = auth.currentUser?.uid;
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  let hasHandledInitialSnapshot = false;
  const q = query(
    messagesRef,
    orderBy('createdAt', 'asc'),
    limitToLast(LIVE_MESSAGES_WINDOW_SIZE)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages: Message[] = [];
      const unreadIncomingMessageIds: string[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        messages.push({
          id: docSnap.id,
          conversationId,
          senderId: data.senderId,
          content: data.content || '',
          mediaUrl: data.mediaUrl,
          senderName: data.senderName,
          senderPhoto: data.senderPhoto,
          isRead: data.isRead || false,
          createdAt: data.createdAt,
        });

        if (
          currentUserId &&
          data.senderId !== currentUserId &&
          !data.isRead &&
          !docSnap.metadata.hasPendingWrites
        ) {
          unreadIncomingMessageIds.push(docSnap.id);
        }
      });

      messages.forEach((msg) => {
        if (!msg.senderName && msg.senderId === currentUserId) {
          msg.senderName = getImmediateCurrentUserChatProfile().name;
        }
      });

      callback(messages);

      if (
        hasHandledInitialSnapshot &&
        currentUserId &&
        unreadIncomingMessageIds.length > 0 &&
        !readReceiptInFlight.has(conversationId)
      ) {
        readReceiptInFlight.add(conversationId);
        Promise.all(
          unreadIncomingMessageIds.map((messageId) =>
            updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
              isRead: true,
            })
          )
        )
          .catch((error) => {
            if (error?.code !== 'permission-denied') {
              console.warn('Direct read receipt update failed:', error);
            }
          })
          .finally(() => {
            readReceiptInFlight.delete(conversationId);
          });
      }

      hasHandledInitialSnapshot = true;
    },
    (error: any) => {
      if (error?.code === 'permission-denied') {
        console.warn('Chat subscription blocked by permission-denied for conversation:', conversationId);
        callback([]);
        onError?.(error);
        return;
      }

      console.error('Error subscribing to messages:', error);
      onError?.(error);
    }
  );

  return unsubscribe;
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  conversationId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const snapshot = await getDocs(q);
    const unreadMessagesFromOthers = snapshot.docs.filter(
      (docSnap) => {
        const data = docSnap.data();
        return data.senderId !== currentUser.uid && data.isRead !== true;
      }
    );
    
    const updatePromises = unreadMessagesFromOthers.map((docSnap) => {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', docSnap.id);
      return updateDoc(messageRef, { isRead: true });
    });

    await Promise.all(updatePromises);
    unreadCountCache.set(conversationId, { value: 0, fetchedAt: Date.now() });
  } catch (error: any) {
    // Some deployments restrict message read-receipt updates by rules.
    // Do not break chat initialization/subscriptions when that happens.
    if (error?.code === 'permission-denied') {
      console.warn('Skipping markMessagesAsRead due to permission-denied');
      return;
    }

    console.error('Error marking messages as read:', error);
    throw error;
  }
}

