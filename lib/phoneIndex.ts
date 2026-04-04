/**
 * phoneIndex.ts
 *
 * Maps normalized phone digits to the Firebase Auth email used for that account.
 * This allows sign-in by phone even when the account was created with an email
 * (e.g. academy signed up with mci@gmail.com + phone → sign-in with phone resolves to mci@gmail.com).
 *
 * Collection: /phoneIndex/{normalizedDigits}
 *   - Document ID = digits only, e.g. "9987654321"
 *   - Field: authEmail → the Firebase Auth email (e.g. mci@gmail.com or user_9987654321@forsa.app)
 */

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Write a phone → authEmail mapping to /phoneIndex.
 * Call during signup whenever the user has a phone, so sign-in by phone works
 * regardless of whether the account was created with email or phone-based auth.
 */
export async function writePhoneIndex(normalizedPhoneDigits: string, authEmail: string): Promise<void> {
  if (!normalizedPhoneDigits || !authEmail) return;
  const id = normalizedPhoneDigits.replace(/\D/g, '');
  if (!id) return;
  await setDoc(doc(db, 'phoneIndex', id), { authEmail });
}

/**
 * Look up the Firebase Auth email for a given phone number (digits only).
 * Returns the authEmail if found, or null.
 * Used at sign-in when the user enters a phone number so we can resolve to the correct auth identity.
 */
export async function lookupPhoneIndex(normalizedPhoneDigits: string): Promise<string | null> {
  if (!normalizedPhoneDigits) return null;
  const id = normalizedPhoneDigits.replace(/\D/g, '');
  if (!id) return null;
  const snap = await getDoc(doc(db, 'phoneIndex', id));
  if (snap.exists()) {
    return snap.data()?.authEmail ?? null;
  }
  return null;
}

/**
 * Remove a phone mapping (e.g. when user changes phone).
 */
export async function deletePhoneIndex(normalizedPhoneDigits: string): Promise<void> {
  if (!normalizedPhoneDigits) return;
  const id = normalizedPhoneDigits.replace(/\D/g, '');
  if (!id) return;
  await deleteDoc(doc(db, 'phoneIndex', id));
}
