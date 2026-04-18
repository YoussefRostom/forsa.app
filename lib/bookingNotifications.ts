import {
  createNotificationLocally,
  createNotificationsLocallyForUsers,
  createNotification,
  getAdminUserIds,
  notifyProviderAndAdmins,
} from '../services/NotificationService';

const isIgnorableBookingNotificationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /network request timed out|timed out|aborted|must be authenticated to create notification/i.test(message);
};

const getBookingLabel = (booking: any) => {
  return (
    booking?.service ||
    booking?.program ||
    booking?.providerName ||
    booking?.name ||
    'your booking'
  );
};

const getCustomerUserId = (booking: any) => {
  return booking?.parentId || booking?.playerId || booking?.academyId || booking?.userId || null;
};

export async function notifyBookingStatusChange(params: {
  booking: any;
  nextStatus: string;
  actorId?: string;
  actorLabel?: string;
  proposedDate?: string | null;
  proposedTime?: string | null;
}) {
  const { booking, nextStatus, actorId, actorLabel = 'A user', proposedDate, proposedTime } = params;
  if (!booking?.id) return;

  const bookingLabel = getBookingLabel(booking);
  const providerId = booking?.providerId;
  const customerUserId = getCustomerUserId(booking);

  let title = 'Booking update';
  let providerBody = `${actorLabel} updated the booking for ${bookingLabel}.`;
  let customerBody = `Your booking for ${bookingLabel} was updated.`;

  switch (nextStatus) {
    case 'cancelled':
      title = 'Booking cancelled';
      providerBody = `${actorLabel} cancelled the booking for ${bookingLabel}.`;
      customerBody = `Your booking for ${bookingLabel} has been cancelled.`;
      break;
    case 'new_time_proposed':
      title = 'New time proposed';
      providerBody = `A new time was proposed for ${bookingLabel}${proposedDate ? ` on ${proposedDate}` : ''}${proposedTime ? ` at ${proposedTime}` : ''}.`;
      customerBody = `A new time was proposed for ${bookingLabel}${proposedDate ? ` on ${proposedDate}` : ''}${proposedTime ? ` at ${proposedTime}` : ''}.`;
      break;
    case 'confirmed':
      title = 'Booking confirmed';
      providerBody = `${bookingLabel} is now confirmed.`;
      customerBody = `Your booking for ${bookingLabel} is confirmed.`;
      break;
  }

  try {
    if (providerId) {
      const adminIds = await getAdminUserIds();
      const recipientIds = [providerId, ...adminIds].filter((userId) => userId && userId !== actorId);
      await createNotificationsLocallyForUsers(
        recipientIds,
        title,
        providerBody,
        'booking',
        { bookingId: booking.id, status: nextStatus }
      );
    }
  } catch (error) {
    if (!isIgnorableBookingNotificationError(error)) {
      console.warn('Provider/admin booking notification failed:', error);
    }
  }

  try {
    if (customerUserId && customerUserId !== actorId) {
      await createNotificationLocally({
        userId: customerUserId,
        title,
        body: customerBody,
        type: 'booking',
        data: { bookingId: booking.id, status: nextStatus },
      });
    }
  } catch (error) {
    if (!isIgnorableBookingNotificationError(error)) {
      console.warn('Customer booking notification failed:', error);
    }
  }
}

export async function notifyBookingRequestCreated(params: {
  bookingId: string;
  providerId?: string | null;
  actorId?: string;
  customerUserId?: string | null;
  providerTitle: string;
  providerBody: string;
  customerTitle: string;
  customerBody: string;
  logPrefix?: string;
}) {
  const {
    bookingId,
    providerId,
    actorId,
    customerUserId,
    providerTitle,
    providerBody,
    customerTitle,
    customerBody,
    logPrefix = 'Booking request notification failed:',
  } = params;

  if (!bookingId) return;

  const tasks: Promise<void>[] = [];

  if (customerUserId) {
    tasks.push((async () => {
      try {
        await createNotificationLocally({
          userId: customerUserId,
          title: customerTitle,
          body: customerBody,
          type: 'booking',
          data: { bookingId },
        });
      } catch (error) {
        if (!isIgnorableBookingNotificationError(error)) {
          console.warn(`${logPrefix} customer`, error);
        }
      }
    })());
  }

  if (providerId) {
    tasks.push((async () => {
      try {
        const adminIds = await getAdminUserIds();
        const recipientIds = [providerId, ...adminIds].filter((userId) => userId && userId !== actorId);
        await createNotificationsLocallyForUsers(
          recipientIds,
          providerTitle,
          providerBody,
          'booking',
          { bookingId }
        );
      } catch (error) {
        if (!isIgnorableBookingNotificationError(error)) {
          console.warn(`${logPrefix} provider/admin`, error);
        }
      }
    })());
  }

  await Promise.allSettled(tasks);
}
