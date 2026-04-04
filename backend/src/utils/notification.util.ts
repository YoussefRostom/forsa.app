import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase';

export type NotificationType = 'booking' | 'checkin' | 'report' | 'info' | 'system';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string | number | boolean>;
  createdBy?: string;
}

/**
 * Create a notification document in Firestore (backend only).
 * Uses Admin SDK so it bypasses security rules. Same shape as frontend notifications
 * so the app can read them via subscribeMyNotifications.
 */
export async function createNotificationForUser(params: CreateNotificationParams): Promise<string> {
  const ref = await db.collection('notifications').add({
    userId: params.userId,
    title: params.title,
    body: params.body,
    type: params.type,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: params.createdBy ?? null,
    data: params.data ?? null,
  });
  return ref.id;
}
