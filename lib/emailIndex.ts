/**
 * emailIndex.ts
 *
 * A publicly-readable Firestore collection that maps a user's real email address
 * to the Firebase Auth email used for that account (user_{phone}@forsa.app format).
 *
 * This allows email-based login without exposing any sensitive user data — the
 * document only contains { authEmail: string } and nothing else.
 *
 * Collection: /emailIndex/{encodedEmail}
 *   - Document ID = email address with dots replaced by commas (Firestore key-safe)
 *   - Field: authEmail → the Firebase Auth email (e.g. user_966501234567@forsa.app)
 */

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

/** Encode an email address into a Firestore-safe document ID */
function encodeEmail(email: string): string {
    return email.trim().toLowerCase().replace(/\./g, ',');
}

/**
 * Write an email → authEmail mapping to /emailIndex.
 * Call this during signup if the user provided an optional email.
 */
export async function writeEmailIndex(email: string, authEmail: string): Promise<void> {
    if (!email || !email.trim()) return;
    const id = encodeEmail(email);
    await setDoc(doc(db, 'emailIndex', id), { authEmail });
}

/**
 * Look up the Firebase Auth email for a given user email address.
 * Returns the authEmail string if found, or null if not found.
 * This collection is publicly readable, so it works before login.
 */
export async function lookupEmailIndex(email: string): Promise<string | null> {
    if (!email || !email.trim()) return null;
    const id = encodeEmail(email);
    const snap = await getDoc(doc(db, 'emailIndex', id));
    if (snap.exists()) {
        return snap.data()?.authEmail ?? null;
    }
    return null;
}

/**
 * Remove an email mapping (e.g. when user changes or removes their email).
 */
export async function deleteEmailIndex(email: string): Promise<void> {
    if (!email || !email.trim()) return;
    const id = encodeEmail(email);
    await deleteDoc(doc(db, 'emailIndex', id));
}
