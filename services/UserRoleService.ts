import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export type Role = 'player' | 'agent' | 'academy' | 'clinic' | 'parent' | 'admin';

// Cache for user role to avoid repeated reads
let cachedRole: Role | null = null;
let cachedUserId: string | null = null;

/**
 * Get the current user's role from Firestore users collection
 * @returns Promise<Role> - The user's role, defaults to 'player' if not found
 */
export async function getCurrentUserRole(): Promise<Role> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to get role');
  }

  // Return cached role if available and user hasn't changed
  if (cachedRole && cachedUserId === user.uid) {
    return cachedRole;
  }

  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.warn('User document not found, defaulting to player role');
      cachedRole = 'player';
      cachedUserId = user.uid;
      return 'player';
    }

    const userData = userDocSnap.data();
    const role = (userData?.role || 'player').toLowerCase() as Role;
    
    // Cache the result
    cachedRole = role;
    cachedUserId = user.uid;
    
    return role;
  } catch (error: any) {
    console.error('Error fetching user role:', error);
    // Default to player on error for backward compatibility
    cachedRole = 'player';
    cachedUserId = user.uid;
    return 'player';
  }
}

/**
 * Clear the cached role (useful after logout or role change)
 */
export function clearRoleCache(): void {
  cachedRole = null;
  cachedUserId = null;
}

/**
 * Get the visible roles for a given owner role based on the visibility graph
 * @param ownerRole - The role of the post owner
 * @returns Array of roles that can see posts from this owner
 */
export function getVisibleToRoles(ownerRole: Role): Role[] {
  switch (ownerRole) {
    case 'player':
      return ['player', 'agent', 'academy', 'clinic', 'parent'];
    case 'agent':
      return ['agent', 'academy', 'clinic'];
    case 'academy':
      return ['academy', 'clinic', 'parent'];
    case 'clinic':
      return ['clinic'];
    case 'parent':
      return ['parent'];
    case 'admin':
      // Admin posts are visible to ALL roles
      return ['player', 'agent', 'academy', 'clinic', 'parent'];
    default:
      // Default to player visibility
      return ['player', 'agent', 'academy', 'clinic', 'parent'];
  }
}

