export const formatBookingPublicId = (bookingId: string) => {
  const normalized = String(bookingId || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!normalized) return 'BK------';
  return `BK-${normalized.slice(-8).padStart(8, '0')}`;
};

export const getBookingPublicId = (booking: { id?: string; bookingPublicId?: string | null } | string | null | undefined) => {
  if (typeof booking === 'string') return formatBookingPublicId(booking);

  const explicit = String(booking?.bookingPublicId || '').trim();
  if (explicit) return explicit;

  return formatBookingPublicId(String(booking?.id || ''));
};