import { auth, db } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  limit,
} from 'firebase/firestore';
import { getUserByCheckInCode } from './CheckInCodeService';
import { getCurrentUserRole } from './UserRoleService';
import { doc, getDoc } from 'firebase/firestore';
import { notifyAdmins, createNotification } from './NotificationService';

export type CheckInLocationRole = 'academy' | 'clinic';

export interface CheckIn {
  id: string;
  userId: string;
  userRole: 'player' | 'parent';
  userCheckInCode: string;
  locationId: string;
  locationRole: CheckInLocationRole;
  createdAt: Timestamp | any;
  createdBy: string;
  meta?: {
    deviceTime?: number;
    note?: string | null;
  };
  // Denormalized fields (optional, for admin UI speed)
  userName?: string;
  locationName?: string;
}

export interface CheckInFilters {
  todayOnly?: boolean;
  locationRole?: CheckInLocationRole;
}

/**
 * Check if user has checked in to the same location within the last 5 minutes
 * Uses in-memory filtering to avoid composite index requirement
 */
async function hasRecentCheckIn(
  userId: string,
  locationId: string,
  minutesThreshold: number = 5
): Promise<boolean> {
  try {
    const thresholdMs = minutesThreshold * 60 * 1000;
    const thresholdDate = new Date(Date.now() - thresholdMs);

    const checkInsRef = collection(db, 'checkins');
    // Query without orderBy and createdAt filter to avoid index requirement
    // We'll filter by time in memory
    const q = query(
      checkInsRef,
      where('userId', '==', userId),
      where('locationId', '==', locationId)
    );

    const snapshot = await getDocs(q);
    
    // Filter by createdAt in memory
    const recentCheckIns = snapshot.docs.filter(doc => {
      const data = doc.data();
      const createdAt = data.createdAt;
      
      if (!createdAt) return false;
      
      // Handle Firestore Timestamp
      let checkInDate: Date;
      if (createdAt && typeof createdAt.toDate === 'function') {
        checkInDate = createdAt.toDate();
      } else if (createdAt?.seconds) {
        checkInDate = new Date(createdAt.seconds * 1000);
      } else if (createdAt?._seconds) {
        checkInDate = new Date(createdAt._seconds * 1000);
      } else if (createdAt instanceof Date) {
        checkInDate = createdAt;
      } else {
        return false;
      }
      
      return checkInDate >= thresholdDate;
    });

    return recentCheckIns.length > 0;
  } catch (error: any) {
    console.error('Error checking recent check-in:', error);
    // On error, allow check-in (fail open)
    return false;
  }
}

/**
 * Get user name from user document
 */
async function getUserName(userId: string): Promise<string | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    
    // Try role-specific name fields first
    if (userData.agentName) return userData.agentName;
    if (userData.academyName) return userData.academyName;
    if (userData.clinicName) return userData.clinicName;
    if (userData.parentName) return userData.parentName;
    if (userData.playerName) return userData.playerName;
    
    // Fallback to firstName/lastName
    if (userData.firstName && userData.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    if (userData.firstName || userData.lastName) {
      return userData.firstName || userData.lastName;
    }
    
    // Fallback to email or phone
    if (userData.email) return userData.email.split('@')[0];
    if (userData.phone) return userData.phone;
    
    return null;
  } catch (error: any) {
    console.error('Error getting user name:', error);
    return null;
  }
}

/**
 * Get location name from user document
 */
async function getLocationName(locationId: string): Promise<string | null> {
  try {
    const locationRef = doc(db, 'users', locationId);
    const locationDoc = await getDoc(locationRef);
    
    if (!locationDoc.exists()) {
      return null;
    }
    
    const locationData = locationDoc.data();
    
    if (locationData.academyName) return locationData.academyName;
    if (locationData.clinicName) return locationData.clinicName;
    if (locationData.agentName) return locationData.agentName;
    
    // Fallback
    if (locationData.firstName && locationData.lastName) {
      return `${locationData.firstName} ${locationData.lastName}`;
    }
    
    return locationData.email?.split('@')[0] || locationData.phone || null;
  } catch (error: any) {
    console.error('Error getting location name:', error);
    return null;
  }
}

/**
 * Create a check-in from a scanned QR code
 * @param code - The check-in code extracted from QR (without "forsa_checkin:" prefix)
 * @param note - Optional note for the check-in
 */
export async function createCheckInFromScan(
  code: string,
  note?: string
): Promise<CheckIn> {
  const staffUser = auth.currentUser;
  if (!staffUser) {
    throw new Error('Staff user must be authenticated');
  }

  try {
    // Get staff role
    const staffRole = await getCurrentUserRole();
    
    if (staffRole !== 'academy' && staffRole !== 'clinic') {
      throw new Error('Only academy and clinic staff can create check-ins');
    }

    // Get user ID from check-in code
    const userId = await getUserByCheckInCode(code);
    if (!userId) {
      throw new Error('Invalid check-in code');
    }

    // Verify user exists and has correct role
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const userRole = userData.role?.toLowerCase();
    
    if (userRole !== 'player' && userRole !== 'parent') {
      throw new Error('Check-in code belongs to a user who cannot check in');
    }

    // Check for recent check-in (5 minute cooldown)
    const locationId = staffUser.uid; // Staff's own uid is the location
    const hasRecent = await hasRecentCheckIn(userId, locationId, 5);
    
    if (hasRecent) {
      throw new Error('User has already checked in recently. Please wait before scanning again.');
    }

    // Get user and location names for denormalization
    const userName = await getUserName(userId);
    const locationName = await getLocationName(locationId);

    // Create check-in document
    const checkInData = {
      userId: userId,
      userRole: userRole as 'player' | 'parent',
      userCheckInCode: code,
      locationId: locationId,
      locationRole: staffRole as CheckInLocationRole,
      createdAt: serverTimestamp(),
      createdBy: staffUser.uid,
      meta: {
        deviceTime: Date.now(),
        note: note || null,
      },
      userName: userName || null,
      locationName: locationName || null,
    };

    const checkInsRef = collection(db, 'checkins');
    const checkInRef = await addDoc(checkInsRef, checkInData);

    try {
      await notifyAdmins(
        'New check-in',
        locationName ? `${userName || 'User'} checked in at ${locationName}` : `${userName || 'User'} (${userRole}) checked in`,
        'checkin',
        { checkInId: checkInRef.id, locationId, userId }
      );
      await createNotification({
        userId,
        title: 'Check-in recorded',
        body: locationName ? `You checked in at ${locationName}` : 'Check-in successful',
        type: 'checkin',
        data: { checkInId: checkInRef.id },
      });
    } catch (e) {
      console.warn('Check-in notification failed:', e);
    }

    // Return the created check-in
    return {
      id: checkInRef.id,
      ...checkInData,
      createdAt: Timestamp.now(), // Approximate, will be updated by server
    } as CheckIn;
  } catch (error: any) {
    console.error('Error creating check-in:', error);
    throw new Error(`Failed to create check-in: ${error.message}`);
  }
}

/**
 * Subscribe to check-ins for admin (realtime listener)
 * @param filters - Optional filters for check-ins
 * @param callback - Callback function that receives check-ins array
 * @returns Unsubscribe function
 */
export function subscribeAdminCheckIns(
  filters: CheckInFilters | null,
  callback: (checkIns: CheckIn[]) => void
): () => void {
  const checkInsRef = collection(db, 'checkins');
  
  // Query without orderBy to avoid index requirement, we'll sort in memory
  let q;
  if (filters?.locationRole) {
    q = query(
      checkInsRef,
      where('locationRole', '==', filters.locationRole)
    );
  } else {
    q = query(checkInsRef);
  }

  const unsubscribe = onSnapshot(
    q,
    async (querySnapshot) => {
      let checkIns: CheckIn[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as CheckIn[];

      // Filter by location role if needed
      if (filters?.locationRole) {
        checkIns = checkIns.filter(ci => ci.locationRole === filters.locationRole);
      }

      // Filter by today only if needed
      if (filters?.todayOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);
        
        checkIns = checkIns.filter(ci => {
          const createdAt = ci.createdAt;
          if (!createdAt) return false;
          
          const checkInDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
          return checkInDate >= today;
        });
      }

      // Sort by createdAt in memory (newest first)
      checkIns.sort((a, b) => {
        const dateA = getDateFromTimestamp(a.createdAt);
        const dateB = getDateFromTimestamp(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      callback(checkIns);
    },
    (error) => {
      console.error('Error subscribing to check-ins:', error);
      callback([]);
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to user's own check-ins
 * @param userId - User ID
 * @param callback - Callback function that receives check-ins array
 * @returns Unsubscribe function
 */
export function subscribeMyCheckIns(
  userId: string,
  callback: (checkIns: CheckIn[]) => void
): () => void {
  const checkInsRef = collection(db, 'checkins');
  // Query without orderBy to avoid index requirement, sort in memory
  const q = query(
    checkInsRef,
    where('userId', '==', userId)
  );

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      let checkIns: CheckIn[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as CheckIn[];
      
      // Sort by createdAt in memory (newest first)
      checkIns.sort((a, b) => {
        const dateA = getDateFromTimestamp(a.createdAt);
        const dateB = getDateFromTimestamp(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      callback(checkIns);
    },
    (error) => {
      console.error('Error subscribing to user check-ins:', error);
      callback([]);
    }
  );

  return unsubscribe;
}

/**
 * Helper function to safely get date from Firestore timestamp
 */
function getDateFromTimestamp(timestamp: any): Date {
  if (!timestamp) return new Date(0);
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
}

