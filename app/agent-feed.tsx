import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot, getFirestore, orderBy, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import React, { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import PostActionsMenu from '../components/PostActionsMenu';
import i18n from '../locales/i18n';
import { db, auth } from '../lib/firebase';

// Helper function to get user name from role-specific collection
async function getUserName(ownerId: string, ownerRole: string): Promise<string> {
  try {
    // Map role to collection name
    const roleCollectionMap: { [key: string]: string } = {
      'player': 'players',
      'parent': 'parents',
      'academy': 'academies',
      'clinic': 'clinics',
      'agent': 'agents'
    };

    const collectionName = roleCollectionMap[ownerRole] || 'users';
    
    // Try role-specific collection first
    if (collectionName !== 'users') {
      const roleDocRef = doc(db, collectionName, ownerId);
      const roleDocSnap = await getDoc(roleDocRef);
      
      if (roleDocSnap.exists()) {
        const data = roleDocSnap.data();
        // Get name based on role
        if (ownerRole === 'player') {
          const firstName = data.firstName || '';
          const lastName = data.lastName || '';
          return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unknown';
        } else if (ownerRole === 'parent') {
          return data.parentName || data.name || 'Unknown';
        } else if (ownerRole === 'academy') {
          return data.academyName || data.name || 'Unknown';
        } else if (ownerRole === 'clinic') {
          return data.clinicName || data.name || 'Unknown';
        } else if (ownerRole === 'agent') {
          const firstName = data.firstName || '';
          const lastName = data.lastName || '';
          return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unknown';
        }
      }
    }

    // Fallback to users collection
    const userDocRef = doc(db, 'users', ownerId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      if (data.firstName && data.lastName) {
        return `${data.firstName} ${data.lastName}`;
      }
      return data.firstName || data.lastName || data.name || data.parentName || data.academyName || data.clinicName || 'Unknown';
    }

    return 'Unknown';
  } catch (error) {
    console.error('Error fetching user name:', error);
    return 'Unknown';
  }
}

export default function AgentFeedScreen() {
  const router = useRouter();
  const { openMenu } = useHamburgerMenu();
  const [feed, setFeed] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userNames, setUserNames] = React.useState<{ [key: string]: string }>({});
  const [fullScreenMedia, setFullScreenMedia] = React.useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [agentPosts, setAgentPosts] = React.useState<any[]>([]);
  const [adminPosts, setAdminPosts] = React.useState<any[]>([]);

  // Merge agent posts and admin posts (deduplicate by post ID)
  React.useEffect(() => {
    const active = (p: any) => !p.status || p.status === 'active';
    const getTs = (p: any) => p.timestamp?.seconds ?? p.createdAt?.seconds ?? 0;
    
    // Combine both arrays and deduplicate by post ID
    const allPosts = [...agentPosts.filter(active), ...adminPosts.filter(active)];
    const uniquePostsMap = new Map<string, any>();
    
    // Use Map to ensure unique posts by ID (later posts override earlier ones)
    allPosts.forEach(post => {
      if (post.id) {
        uniquePostsMap.set(post.id, post);
      }
    });
    
    // Convert back to array and sort by timestamp
    const merged = Array.from(uniquePostsMap.values())
      .sort((a, b) => getTs(b) - getTs(a));
    setFeed(merged);
    
    // Fetch user names for merged posts
    const namePromises = merged.map(async (post: any) => {
      if (post.ownerId && post.ownerRole) {
        const name = await getUserName(post.ownerId, post.ownerRole);
        return { key: post.ownerId, name };
      }
      return null;
    });
    
    Promise.all(namePromises).then(nameResults => {
      const namesMap: { [key: string]: string } = {};
      nameResults.forEach(result => {
        if (result) {
          namesMap[result.key] = result.name;
        }
      });
      setUserNames(namesMap);
    });
  }, [agentPosts, adminPosts]);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  React.useEffect(() => {
    setLoading(true);
    
    // Check if user is authenticated before setting up listener
    const user = auth.currentUser;
    if (!user) {
      setFeed([]);
      setLoading(false);
      return;
    }
    
    const db = getFirestore();
    const postsRef = collection(db, 'posts');
    
    // Agent feed: Show posts where visibleToRoles array-contains "agent" AND status == "active"
    const q = query(
      postsRef,
      where('visibleToRoles', 'array-contains', 'agent'),
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc')
    );

    // Admin posts query (visible to all users)
    // Query only by ownerRole to avoid composite index requirement
    // Filter by status and sort client-side
    const qAdmin = query(
      postsRef,
      where('ownerRole', '==', 'admin')
    );

    // Set up real-time listener for agent posts
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!auth.currentUser) {
          setAgentPosts([]);
          return;
        }
        
        const posts = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setAgentPosts(posts);
      },
      (error) => {
        // Check if user is still authenticated before attempting fallback
        if (!auth.currentUser) {
          setFeed([]);
          setLoading(false);
          return;
        }
        
        // Check if error is due to permissions (user logged out)
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          console.error('Agent feed listener error (permission denied):', error);
          setFeed([]);
          setLoading(false);
          return;
        }
        
        console.error('Agent feed listener error:', error);
        // Fallback: try querying without status filter for backward compatibility
        const fallbackQ = query(
          postsRef,
          where('visibleToRoles', 'array-contains', 'agent'),
          orderBy('timestamp', 'desc')
        );
        
        let fallbackUnsubscribe: (() => void) | null = null;
        fallbackUnsubscribe = onSnapshot(
          fallbackQ,
          async (snapshot) => {
            // Check authentication again before processing
            if (!auth.currentUser) {
              if (fallbackUnsubscribe) fallbackUnsubscribe();
              setFeed([]);
              setLoading(false);
              return;
            }
            
            const posts = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter((post: any) => !post.status || post.status === 'active');
            setFeed(posts);
            
            // Fetch user names for all posts (only if authenticated)
            if (auth.currentUser) {
              const namePromises = posts.map(async (post: any) => {
                if (post.ownerId && post.ownerRole) {
                  try {
                    const name = await getUserName(post.ownerId, post.ownerRole);
                    return { key: post.ownerId, name };
                  } catch (err) {
                    // Silently handle errors when fetching user names
                    return null;
                  }
                }
                return null;
              });
              
              const nameResults = await Promise.all(namePromises);
              const namesMap: { [key: string]: string } = {};
              nameResults.forEach(result => {
                if (result) {
                  namesMap[result.key] = result.name;
                }
              });
              setUserNames(namesMap);
            }
            setLoading(false);
          },
          (fallbackError) => {
            // Check if error is due to permissions
            if (fallbackError.code === 'permission-denied' || fallbackError.message?.includes('permission')) {
              console.error('Agent feed fallback error (permission denied):', fallbackError);
            } else {
              console.error('Agent feed fallback error:', fallbackError);
            }
            setFeed([]);
            setLoading(false);
          }
        );
      }
    );

    // Set up listener for admin posts
    const unsubscribeAdmin = onSnapshot(
      qAdmin,
      (querySnapshot) => {
        if (!auth.currentUser) {
          setAdminPosts([]);
          return;
        }
        
        // Filter by status and sort client-side to avoid composite index
        const posts = querySnapshot.docs
          .map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }))
          .filter((post: any) => !post.status || post.status === 'active')
          .sort((a: any, b: any) => {
            const getTs = (p: any) => p.timestamp?.seconds ?? p.createdAt?.seconds ?? 0;
            return getTs(b) - getTs(a);
          });
        setAdminPosts(posts);
      },
      async (error) => {
        if (!auth.currentUser) {
          setAdminPosts([]);
          return;
        }
        
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          setAdminPosts([]);
          return;
        }
        
        console.error('Agent feed (admin) error:', error?.message);
        setAdminPosts([]);
      }
    );

    // Stop loading after both queries have run
    const t = setTimeout(() => setLoading(false), 800);

    // Cleanup listeners on unmount
    return () => {
      unsubscribe();
      unsubscribeAdmin();
      clearTimeout(t);
    };
  }, []);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('agentFeed') || 'Feed'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('latestUpdates') || 'Latest updates from players'}</Text>
            </View>
      </View>

      <HamburgerMenu />

      {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
            </View>
      ) : (
        <FlatList
          data={feed}
              renderItem={({ item }: any) => {
                const timestamp = item.timestamp?.seconds 
                  ? new Date(item.timestamp.seconds * 1000) 
                  : item.createdAt?.seconds 
                    ? new Date(item.createdAt.seconds * 1000)
                    : null;

                const userName = userNames[item.ownerId] || item.author || 'User';
                const roleLabel = item.ownerRole ? `(${item.ownerRole})` : '';
                const displayName = `${userName}${roleLabel}`;

                return (
                  <View style={styles.feedCard}>
                    <View style={styles.feedHeader}>
                      <TouchableOpacity 
                        style={styles.feedAuthorContainer}
                        onPress={() => {
                          if (item.ownerId && item.ownerRole) {
                            router.push({
                              pathname: '/agent-user-posts',
                              params: {
                                ownerId: item.ownerId,
                                ownerRole: item.ownerRole,
                                userName: userName
                              }
                            });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person-circle-outline" size={24} color="#000" />
                        <Text 
                          style={styles.feedAuthor}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {displayName}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.feedHeaderRight}>
                        {timestamp && (
                          <Text style={styles.feedTime}>
                            {timestamp.toLocaleDateString()}
                          </Text>
                        )}
                        <PostActionsMenu
                          postId={item.id}
                          postOwnerId={item.ownerId}
                          postOwnerRole={item.ownerRole}
                          mediaUrl={item.mediaUrl}
                          mediaType={item.mediaType}
                          contentText={item.content}
                          postTimestamp={item.timestamp || item.createdAt}
                        />
                      </View>
                    </View>
                    
                    {/* Media display */}
                    {item.mediaUrl && (
                      <View style={styles.mediaContainer}>
                        {item.mediaType === 'video' ? (
                          <Video
                            source={{ uri: item.mediaUrl }}
                            style={styles.mediaVideo}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping={false}
                          />
                        ) : (
                          <Image 
                            source={{ uri: item.mediaUrl }} 
                            style={styles.mediaImage}
                            resizeMode="cover"
                          />
                        )}
                        <TouchableOpacity
                          style={styles.fullScreenButton}
                          onPress={() => setFullScreenMedia({ uri: item.mediaUrl, type: item.mediaType === 'video' ? 'video' : 'image' })}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="expand" size={24} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    <Text style={styles.feedContent}>{item.content || ''}</Text>
                  </View>
                );
              }}
          keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="newspaper-outline" size={64} color="#666" />
                  <Text style={styles.emptyText}>{i18n.t('noPosts') || 'No posts yet'}</Text>
                  <Text style={styles.emptySubtext}>{i18n.t('beFirstToPost') || 'Be the first to share something!'}</Text>
    </View>
              }
            />
          )}
        </Animated.View>
      </LinearGradient>

      {/* Full Screen Media Viewer */}
      <Modal
        visible={!!fullScreenMedia}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullScreenMedia(null)}
        statusBarTranslucent={true}
      >
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={() => setFullScreenMedia(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {fullScreenMedia && (
            <View style={styles.fullScreenContent}>
              {fullScreenMedia.type === 'video' ? (
                <Video
                  source={{ uri: fullScreenMedia.uri }}
                  style={styles.fullScreenVideo}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                />
              ) : (
                <Image
                  source={{ uri: fullScreenMedia.uri }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              )}
            </View>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginLeft: -44, // Negative margin to center title while keeping menu button on left
    paddingHorizontal: 44, // Add padding to ensure title doesn't overlap with menu button
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  feedCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  feedHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  feedAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },
  feedAuthor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flexShrink: 1,
  },
  feedContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginTop: 12,
  },
  feedTime: {
    fontSize: 12,
    color: '#999',
  },
  mediaContainer: {
    width: '100%',
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  mediaImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  mediaVideo: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
  },
  fullScreenButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
});
