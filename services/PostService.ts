import { auth, db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Update post content (owner only).
 */
export async function updatePost(
  postId: string,
  updates: { content?: string }
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be authenticated');

  const postRef = doc(db, 'posts', postId);
  const data: Record<string, any> = { updatedAt: serverTimestamp() };
  if (updates.content !== undefined) {
    data.content = updates.content;
    data.contentText = updates.content;
  }

  await updateDoc(postRef, data);
}

/**
 * Soft-delete post by owner (sets status to 'deleted').
 */
export async function deletePostByOwner(postId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be authenticated');

  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    status: 'deleted',
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
  });
}
