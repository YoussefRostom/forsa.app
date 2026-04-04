import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getCurrentUserRole } from './UserRoleService';

/**
 * Generate a unique check-in code
 * Format: FC-{10 character base32/hex string}
 */
function generateCheckInCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32-like, excluding I and O
  let code = 'FC-';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Reserve a check-in code in Firestore to ensure uniqueness
 * Returns true if code was successfully reserved, false if already exists
 */
async function reserveCheckInCode(code: string, uid: string): Promise<boolean> {
  try {
    const codeRef = doc(db, 'checkInCodes', code);
    
    const result = await runTransaction(db, async (transaction) => {
      const codeDoc = await transaction.get(codeRef);
      
      if (codeDoc.exists()) {
        // Code already reserved by someone else
        return false;
      }
      
      // Reserve the code
      transaction.set(codeRef, {
        uid: uid,
        createdAt: serverTimestamp(),
      });
      
      return true;
    });
    
    return result;
  } catch (error: any) {
    console.error('Error reserving check-in code:', error);
    return false;
  }
}

/**
 * Generate and reserve a unique check-in code
 * Retries if code collision occurs
 */
async function generateAndReserveCode(uid: string): Promise<string | null> {
  const maxRetries = 10;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateCheckInCode();
    const reserved = await reserveCheckInCode(code, uid);
    
    if (reserved) {
      return code;
    }
  }
  
  console.error('Failed to generate unique check-in code after max retries');
  return null;
}

/**
 * Get check-in code for a user by code string
 * Returns the user ID if code exists, null otherwise
 */
export async function getUserByCheckInCode(code: string): Promise<string | null> {
  try {
    const codeRef = doc(db, 'checkInCodes', code);
    const codeDoc = await getDoc(codeRef);
    
    if (!codeDoc.exists()) {
      return null;
    }
    
    return codeDoc.data().uid || null;
  } catch (error: any) {
    console.error('Error getting user by check-in code:', error);
    return null;
  }
}

/**
 * Ensure current user has a check-in code
 * Creates one if missing (only for player/parent roles)
 * Uses transaction to ensure atomicity
 */
export async function ensureCheckInCodeForCurrentUser(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  try {
    const userRole = await getCurrentUserRole();
    
    // Only player and parent roles need check-in codes
    if (userRole !== 'player' && userRole !== 'parent') {
      return null;
    }

    const userRef = doc(db, 'users', user.uid);
    
    // Use transaction to ensure atomicity
    const result = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }
      
      const userData = userDoc.data();
      
      // If check-in code already exists, return it
      if (userData.checkInCode) {
        return userData.checkInCode;
      }
      
      // Generate and reserve a new code
      const newCode = await generateAndReserveCode(user.uid);
      
      if (!newCode) {
        throw new Error('Failed to generate unique check-in code');
      }
      
      // Update user document with new code
      transaction.update(userRef, {
        checkInCode: newCode,
        checkInCodeCreatedAt: serverTimestamp(),
      });
      
      return newCode;
    });
    
    return result;
  } catch (error: any) {
    console.error('Error ensuring check-in code:', error);
    throw new Error(`Failed to ensure check-in code: ${error.message}`);
  }
}

/**
 * Get check-in code for current user
 */
export async function getCurrentUserCheckInCode(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return userDoc.data().checkInCode || null;
  } catch (error: any) {
    console.error('Error getting check-in code:', error);
    return null;
  }
}

