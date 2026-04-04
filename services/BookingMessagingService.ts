import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getOrCreateConversation } from './MessagingService';
import { getCurrentUserRole } from './UserRoleService';

/**
 * Get users that the current user can chat with based on bookings
 * For Players/Parents: Can chat with academies/clinics they've booked
 * For Academies/Clinics: Can chat with players/parents who booked them
 * For Agents: Can chat with all players (customer support style)
 */
export async function getChattableUsers(): Promise<Array<{
  userId: string;
  name: string;
  photo?: string;
  role: string;
  bookingId?: string;
  lastBookingDate?: string;
}>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated');
  }

  try {
    const role = await getCurrentUserRole();
    const chattableUsers: Array<{
      userId: string;
      name: string;
      photo?: string;
      role: string;
      bookingId?: string;
      lastBookingDate?: string;
    }> = [];

    if (role === 'player' || role === 'parent') {
      // Players/Parents can chat with academies/clinics they've booked
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where(role === 'player' ? 'playerId' : 'parentId', '==', currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const providerIds = new Set<string>();
      const providerMap = new Map<string, { bookingId: string; date: string; type: string }>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const providerId = data.providerId;
        const bookingType = data.type; // 'academy' or 'clinic'
        if (providerId && bookingType) {
          // Only include if we haven't seen this provider, or this is a more recent booking
          const existing = providerMap.get(providerId);
          if (!existing || 
              (data.createdAt && existing.date < data.createdAt)) {
            providerMap.set(providerId, {
              bookingId: docSnap.id,
              date: data.createdAt || '',
              type: bookingType
            });
            providerIds.add(providerId);
          }
        }
      });

      // Fetch provider details and verify they match the booking type
      for (const providerId of providerIds) {
        try {
          const userRef = doc(db, 'users', providerId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const bookingInfo = providerMap.get(providerId);
            const providerRole = userData.role;
            
            // Only include if the provider's role matches the booking type
            // This ensures clinics only show for clinic bookings, academies only for academy bookings
            if (bookingInfo && 
                ((bookingInfo.type === 'clinic' && providerRole === 'clinic') ||
                 (bookingInfo.type === 'academy' && providerRole === 'academy'))) {
              chattableUsers.push({
                userId: providerId,
                name: userData.academyName || userData.clinicName || userData.firstName || userData.name || 'Unknown',
                photo: userData.profilePhoto,
                role: providerRole || 'unknown',
                bookingId: bookingInfo.bookingId,
                lastBookingDate: bookingInfo.date
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching provider ${providerId}:`, error);
        }
      }

      // Also add all agents as customer support (always available)
      const agentsRef = collection(db, 'users');
      const agentsQuery = query(agentsRef, where('role', '==', 'agent'));
      const agentsSnapshot = await getDocs(agentsQuery);
      
      agentsSnapshot.forEach((docSnap) => {
        const agentData = docSnap.data();
        chattableUsers.push({
          userId: docSnap.id,
          name: agentData.firstName && agentData.lastName
            ? `${agentData.firstName} ${agentData.lastName} (Customer Support)`
            : agentData.firstName || agentData.lastName || agentData.name || 'Customer Support',
          photo: agentData.profilePhoto,
          role: 'agent',
          lastBookingDate: agentData.createdAt
        });
      });
    } else if (role === 'academy' || role === 'clinic') {
      // Academies/Clinics can chat with players/parents who booked them
      // IMPORTANT: Only show customers who have bookings with the specific type (clinic or academy)
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('providerId', '==', currentUser.uid),
        where('type', '==', role) // For clinics: only 'clinic' bookings, for academies: only 'academy' bookings
      );

      const snapshot = await getDocs(q);
      const customerIds = new Set<string>();
      const customerMap = new Map<string, { bookingId: string; date: string; type: string }>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const customerId = data.playerId || data.parentId;
        const bookingType = data.type; // Should be 'clinic' or 'academy'
        
        // Double-check: only include if booking type matches the provider role
        if (customerId && bookingType === role) {
          customerIds.add(customerId);
          // Keep track of most recent booking
          if (!customerMap.has(customerId) || 
              (data.createdAt && customerMap.get(customerId)!.date < data.createdAt)) {
            customerMap.set(customerId, {
              bookingId: docSnap.id,
              date: data.createdAt || '',
              type: bookingType
            });
          }
        }
      });

      // Fetch customer details - only include players/parents who have bookings
      for (const customerId of customerIds) {
        try {
          const userRef = doc(db, 'users', customerId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const bookingInfo = customerMap.get(customerId);
            
            // Verify: only include if customer is a player or parent, and has a valid booking
            if (bookingInfo && (userData.role === 'player' || userData.role === 'parent')) {
              chattableUsers.push({
                userId: customerId,
                name: userData.firstName && userData.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : userData.firstName || userData.lastName || userData.name || 'Unknown',
                photo: userData.profilePhoto,
                role: userData.role || 'unknown',
                bookingId: bookingInfo.bookingId,
                lastBookingDate: bookingInfo.date
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching customer ${customerId}:`, error);
        }
      }

      // Also add all agents as customer support (always available)
      const agentsRef = collection(db, 'users');
      const agentsQuery = query(agentsRef, where('role', '==', 'agent'));
      const agentsSnapshot = await getDocs(agentsQuery);
      
      agentsSnapshot.forEach((docSnap) => {
        const agentData = docSnap.data();
        chattableUsers.push({
          userId: docSnap.id,
          name: agentData.firstName && agentData.lastName
            ? `${agentData.firstName} ${agentData.lastName} (Customer Support)`
            : agentData.firstName || agentData.lastName || agentData.name || 'Customer Support',
          photo: agentData.profilePhoto,
          role: 'agent',
          lastBookingDate: agentData.createdAt
        });
      });
    } else if (role === 'agent') {
      // Agents can chat with all users (players, parents, academies, clinics) - customer support style
      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        where('role', 'in', ['player', 'parent', 'academy', 'clinic'])
      );
      const snapshot = await getDocs(usersQuery);

      snapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        let displayName = 'Unknown';
        
        if (userData.role === 'player' || userData.role === 'parent') {
          displayName = userData.firstName && userData.lastName
            ? `${userData.firstName} ${userData.lastName}`
            : userData.firstName || userData.lastName || userData.name || 'Unknown';
        } else if (userData.role === 'academy') {
          displayName = userData.academyName || userData.firstName || userData.name || 'Academy';
        } else if (userData.role === 'clinic') {
          displayName = userData.clinicName || userData.firstName || userData.name || 'Clinic';
        }
        
        chattableUsers.push({
          userId: docSnap.id,
          name: displayName,
          photo: userData.profilePhoto,
          role: userData.role || 'unknown',
          lastBookingDate: userData.createdAt
        });
      });
    }

    return chattableUsers;
  } catch (error: any) {
    console.error('Error getting chattable users:', error);
    throw error;
  }
}

/**
 * Start a conversation with a user (creates conversation if doesn't exist)
 */
export async function startConversationWithUser(otherUserId: string): Promise<string> {
  return await getOrCreateConversation(otherUserId);
}

/**
 * Check if user can chat with another user based on bookings
 */
export async function canChatWithUser(otherUserId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return false;
  }

  try {
    const role = await getCurrentUserRole();

    // First, check if the other user is an agent - agents are always available for all users
    const otherUserRef = doc(db, 'users', otherUserId);
    const otherUserSnap = await getDoc(otherUserRef);
    if (otherUserSnap.exists()) {
      const otherUserData = otherUserSnap.data();
      if (otherUserData.role === 'agent') {
        // Agents can always be chatted with by anyone (customer support)
        return true;
      }
    }

    if (role === 'agent') {
      // Agents can chat with all users (players, parents, academies, clinics)
      if (otherUserSnap.exists()) {
        const userData = otherUserSnap.data();
        return ['player', 'parent', 'academy', 'clinic'].includes(userData.role);
      }
      return false;
    }

    // For others, check if there's a booking relationship
    const bookingsRef = collection(db, 'bookings');
    
    if (role === 'player' || role === 'parent') {
      // Check if current user has booked the other user (provider)
      const q = query(
        bookingsRef,
        where(role === 'player' ? 'playerId' : 'parentId', '==', currentUser.uid),
        where('providerId', '==', otherUserId)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } else if (role === 'academy' || role === 'clinic') {
      // Check if other user has booked current user
      const q = query(
        bookingsRef,
        where('providerId', '==', currentUser.uid),
        where('type', '==', role),
        where('playerId', '==', otherUserId)
      );
      const snapshot1 = await getDocs(q);
      if (!snapshot1.empty) return true;

      // Also check parentId
      const q2 = query(
        bookingsRef,
        where('providerId', '==', currentUser.uid),
        where('type', '==', role),
        where('parentId', '==', otherUserId)
      );
      const snapshot2 = await getDocs(q2);
      return !snapshot2.empty;
    }

    return false;
  } catch (error) {
    console.error('Error checking chat permission:', error);
    return false;
  }
}
