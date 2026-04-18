import { auth, db } from '../lib/firebase';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
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
    const maxRetries = 10;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }

        const userData = userDoc.data();
        const existingCode = typeof userData.checkInCode === 'string' ? userData.checkInCode.trim() : '';
        if (existingCode) {
          const existingCodeRef = doc(db, 'checkInCodes', existingCode);
          const existingCodeDoc = await transaction.get(existingCodeRef);

          if (!existingCodeDoc.exists()) {
            transaction.set(existingCodeRef, {
              uid: user.uid,
              createdAt: serverTimestamp(),
            });
          }

          return { code: existingCode, collision: false };
        }

        const nextCode = generateCheckInCode();
        const codeRef = doc(db, 'checkInCodes', nextCode);
        const codeDoc = await transaction.get(codeRef);

        if (codeDoc.exists()) {
          return { code: null, collision: true };
        }

        transaction.set(codeRef, {
          uid: user.uid,
          createdAt: serverTimestamp(),
        });

        transaction.update(userRef, {
          checkInCode: nextCode,
          checkInCodeCreatedAt: serverTimestamp(),
        });

        return { code: nextCode, collision: false };
      });

      if (!result.collision && result.code) {
        return result.code;
      }
    }

    throw new Error('Failed to generate unique check-in code after multiple attempts');
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

