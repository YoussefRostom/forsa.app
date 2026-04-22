import { db } from '../config/firebase';
import { UserRole } from '../types';
import {
  resolveBookingCustomerName,
  resolveUserDisplayName as getUserDisplayName,
} from '../utils/displayName.util';

type CommissionMode = 'percentage' | 'flat';
type RevenueSource = 'booking' | 'checkin';
type RevenueStatus = 'pending' | 'earned' | 'cancelled' | 'no_show' | 'refunded' | 'failed';
type PlatformCollectionStatus = 'due' | 'received' | 'cancelled' | 'not_applicable';

type AuthenticatedActor = {
  userId: string;
  role: UserRole;
};

type CompleteBookingCheckInInput = {
  note?: string;
  checkInCode?: string;
};

type RevenueListFilters = {
  source?: 'booking' | 'checkin' | 'all';
  providerId?: string;
  bookingId?: string;
  platformStatus?: 'due' | 'received' | 'cancelled' | 'all';
  page: number;
  limit: number;
};

type RevenueSummaryFilters = Omit<RevenueListFilters, 'page' | 'limit'>;

type CommissionConfig = {
  currency: string;
  mode: CommissionMode;
  value: number;
  minimumFee: number;
  source: string;
};

const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  currency: 'EGP',
  mode: 'percentage',
  value: 15,
  minimumFee: 0,
  source: 'default',
};

const BOOKING_COMPLETABLE_STATUSES = new Set([
  'requested',
  'accepted',
  'pending',
  'confirmed',
  'player_accepted',
]);

const BOOKING_NON_REVENUE_STATUSES = new Set([
  'cancelled',
  'rejected',
  'no_show',
  'refunded',
  'failed',
  'failed_payment',
]);

function createServiceError(message: string, statusCode: number, code: string) {
  const error = new Error(message) as Error & { statusCode?: number; code?: string };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getDateValue(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function formatBookingPublicId(bookingId: string): string {
  const normalized = String(bookingId || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!normalized) return 'BK------';
  return `BK-${normalized.slice(-8).padStart(8, '0')}`;
}

function normalizeRole(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeBookingStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeRevenueSource(value: unknown): RevenueSource | 'unknown' {
  const source = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (source === 'booking' || source === 'checkin') return source;
  return 'unknown';
}

function resolveBookingType(booking: any): string {
  const raw = normalizeRole(booking?.bookingType || booking?.type || booking?.providerRole);
  if (raw === 'academy' || raw === 'clinic') return raw;
  return 'provider';
}

function resolveGrossAmount(booking: any): number {
  const candidates = [
    booking?.price,
    booking?.fee,
    booking?.amount,
    booking?.totalPrice,
    booking?.servicePrice,
    booking?.programFee,
  ];

  for (const candidate of candidates) {
    const parsed = asNumber(candidate, NaN);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return roundMoney(parsed);
    }
  }

  return 0;
}

function resolveBookingCustomerId(booking: any): string | null {
  const candidates = [booking?.userId, booking?.playerId, booking?.parentId, booking?.academyId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function resolveServiceName(booking: any): string {
  const candidates = [
    booking?.serviceName,
    booking?.service,
    booking?.programName,
    booking?.program,
    booking?.sessionType,
    booking?.doctor,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return 'Booking service';
}

function calculateCommissionAmount(grossAmount: number, config: CommissionConfig): number {
  const raw = config.mode === 'flat' ? config.value : (grossAmount * config.value) / 100;
  return roundMoney(Math.max(raw, config.minimumFee));
}

function resolvePlatformCollectionStatus(record: any): PlatformCollectionStatus {
  const raw = normalizeBookingStatus(record?.platformCollectionStatus);
  if (raw === 'due' || raw === 'received' || raw === 'cancelled' || raw === 'not_applicable') {
    return raw;
  }

  const paymentStatus = normalizeBookingStatus(record?.commissionPaymentStatus);
  if (paymentStatus === 'paid') return 'received';
  if (paymentStatus === 'due') return 'due';

  const collectionStatus = normalizeBookingStatus(record?.commissionCollectionStatus);
  if (collectionStatus === 'collected') return 'received';
  if (collectionStatus === 'pending') return 'due';

  const status = normalizeBookingStatus(record?.status);
  if (status === 'cancelled' || status === 'no_show' || status === 'refunded' || status === 'failed') {
    return 'cancelled';
  }

  return Number(record?.platformRevenueAmount || 0) > 0 ? 'due' : 'not_applicable';
}

async function loadSettingsAdminDoc(): Promise<any> {
  try {
    const settingsDoc = await db.collection('settings').doc('admin').get();
    return settingsDoc.exists ? settingsDoc.data() || {} : {};
  } catch (error) {
    console.error('[revenue.service] Failed to read admin settings:', error);
    return {};
  }
}

async function loadProviderContext(providerId?: string | null, bookingType?: string): Promise<{ user: any; profile: any }> {
  if (!providerId) {
    return { user: null, profile: null };
  }

  const normalizedType = bookingType === 'academy' ? 'academies' : bookingType === 'clinic' ? 'clinics' : null;
  const [userDoc, profileDoc] = await Promise.all([
    db.collection('users').doc(providerId).get(),
    normalizedType ? db.collection(normalizedType).doc(providerId).get() : Promise.resolve(null as any),
  ]);

  return {
    user: userDoc.exists ? userDoc.data() || null : null,
    profile: profileDoc?.exists ? profileDoc.data() || null : null,
  };
}

async function resolveCommissionConfig(booking: any): Promise<CommissionConfig> {
  const bookingType = resolveBookingType(booking);
  const providerId = typeof booking?.providerId === 'string' ? booking.providerId : null;
  const settings = await loadSettingsAdminDoc();
  const providerContext = await loadProviderContext(providerId, bookingType);

  const directRate = asNumber(booking?.commissionRate, NaN);
  if (Number.isFinite(directRate) && directRate >= 0) {
    return {
      currency: String(booking?.currency || settings?.currency || DEFAULT_COMMISSION_CONFIG.currency),
      mode: booking?.commissionMode === 'flat' ? 'flat' : 'percentage',
      value: directRate,
      minimumFee: asNumber(booking?.commissionMinimumFee, 0),
      source: 'booking',
    };
  }

  const providerBookingCommission = providerContext.profile?.bookingCommission || providerContext.user?.bookingCommission;
  if (providerBookingCommission && typeof providerBookingCommission === 'object') {
    return {
      currency: String(providerBookingCommission.currency || settings?.currency || DEFAULT_COMMISSION_CONFIG.currency),
      mode: providerBookingCommission.mode === 'flat' ? 'flat' : 'percentage',
      value: asNumber(providerBookingCommission.value, DEFAULT_COMMISSION_CONFIG.value),
      minimumFee: asNumber(providerBookingCommission.minimumFee, 0),
      source: providerContext.profile?.bookingCommission ? 'provider_profile' : 'provider_user',
    };
  }

  const providerRate = asNumber(providerContext.profile?.commissionRate ?? providerContext.user?.commissionRate, NaN);
  if (Number.isFinite(providerRate) && providerRate >= 0) {
    return {
      currency: String(settings?.currency || DEFAULT_COMMISSION_CONFIG.currency),
      mode: 'percentage',
      value: providerRate,
      minimumFee: 0,
      source: providerContext.profile?.commissionRate != null ? 'provider_profile_legacy' : 'provider_user_legacy',
    };
  }

  const settingsCommission = settings?.bookingCommission;
  if (settingsCommission && typeof settingsCommission === 'object') {
    return {
      currency: String(settings?.currency || DEFAULT_COMMISSION_CONFIG.currency),
      mode: settingsCommission.mode === 'flat' ? 'flat' : 'percentage',
      value: asNumber(settingsCommission.value, DEFAULT_COMMISSION_CONFIG.value),
      minimumFee: asNumber(settingsCommission.minimumFee, 0),
      source: 'settings',
    };
  }

  const legacyRate = asNumber(settings?.commissionRate, NaN);
  if (Number.isFinite(legacyRate) && legacyRate >= 0) {
    return {
      currency: String(settings?.currency || DEFAULT_COMMISSION_CONFIG.currency),
      mode: 'percentage',
      value: legacyRate,
      minimumFee: 0,
      source: 'settings_legacy',
    };
  }

  return DEFAULT_COMMISSION_CONFIG;
}

async function resolveProviderName(booking: any): Promise<string> {
  const direct = [booking?.providerName, booking?.locationName, booking?.name];
  for (const candidate of direct) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const providerId = typeof booking?.providerId === 'string' ? booking.providerId : null;
  const providerType = resolveBookingType(booking);
  const providerContext = await loadProviderContext(providerId, providerType);
  return getUserDisplayName(providerContext.profile) || getUserDisplayName(providerContext.user) || 'Unknown provider';
}

function buildBookingRevenuePayload(params: {
  bookingId: string;
  booking: any;
  checkInId: string | null;
  actorId: string;
  note?: string;
  checkInCode?: string;
  existingRecord?: any | null;
  commissionConfig: CommissionConfig;
  providerName: string;
  customerName: string | null;
}) {
  const { bookingId, booking, checkInId, actorId, note, checkInCode, existingRecord, commissionConfig, providerName, customerName } = params;
  const now = new Date();
  const bookingStatus = normalizeBookingStatus(booking?.status);
  const grossAmount = resolveGrossAmount(booking);
  const commissionAmount = calculateCommissionAmount(grossAmount, commissionConfig);
  const hasAttendance = Boolean(checkInId || booking?.checkedInAt || booking?.lastCheckInId || normalizeBookingStatus(booking?.attendanceStatus) === 'checked_in');
  const isNonRevenueState = BOOKING_NON_REVENUE_STATUSES.has(bookingStatus);
  const revenueActive = hasAttendance && !isNonRevenueState;

  let status: RevenueStatus = 'pending';
  if (bookingStatus === 'no_show') status = 'no_show';
  else if (bookingStatus === 'refunded') status = 'refunded';
  else if (bookingStatus === 'failed' || bookingStatus === 'failed_payment') status = 'failed';
  else if (bookingStatus === 'cancelled' || bookingStatus === 'rejected') status = 'cancelled';
  else if (revenueActive) status = 'earned';

  const platformRevenueAmount = revenueActive ? commissionAmount : 0;
  const providerNetAmount = revenueActive ? roundMoney(Math.max(grossAmount - commissionAmount, 0)) : 0;

  const existingPlatformStatus = resolvePlatformCollectionStatus(existingRecord);
  const platformCollectionStatus: PlatformCollectionStatus =
    platformRevenueAmount > 0
      ? existingPlatformStatus === 'received'
        ? 'received'
        : 'due'
      : status === 'cancelled' || status === 'no_show' || status === 'refunded' || status === 'failed'
        ? 'cancelled'
        : 'not_applicable';

  const commissionPaymentStatus =
    platformCollectionStatus === 'received'
      ? 'paid'
      : platformRevenueAmount > 0
        ? 'due'
        : null;

  const commissionCollectionStatus =
    platformCollectionStatus === 'received'
      ? 'collected'
      : platformRevenueAmount > 0
        ? 'pending'
        : 'not_applicable';

  const revenueRecord = {
    type: 'booking_commission',
    revenueSource: 'booking' as RevenueSource,
    source: 'backend_booking_checkin',
    bookingId,
    checkInId,
    providerId: booking?.providerId || null,
    providerName,
    providerRole: resolveBookingType(booking),
    customerId: resolveBookingCustomerId(booking),
    customerName,
    serviceName: resolveServiceName(booking),
    bookingPublicId: booking?.bookingPublicId || formatBookingPublicId(bookingId),
    referenceCode: booking?.bookingPublicId || formatBookingPublicId(bookingId),
    currency: String(booking?.currency || commissionConfig.currency || DEFAULT_COMMISSION_CONFIG.currency),
    grossAmount,
    bookingAmount: grossAmount,
    bookingCommissionAmount: platformRevenueAmount,
    platformRevenueAmount,
    providerNetAmount,
    commissionPercentage: commissionConfig.mode === 'percentage' ? commissionConfig.value : null,
    commissionMode: commissionConfig.mode,
    commissionRateSource: commissionConfig.source,
    commissionMinimumFee: commissionConfig.minimumFee,
    bookingStatus,
    attendanceVerifiedAt: revenueActive ? (booking?.checkedInAt || booking?.lastCheckInAt || now) : null,
    paymentStatus: revenueActive ? 'paid' : status === 'refunded' ? 'refunded' : status === 'failed' ? 'failed' : 'pending',
    payoutStatus: revenueActive ? 'pending' : status === 'no_show' ? 'held' : 'not_ready',
    commissionPaymentStatus,
    commissionCollectionStatus,
    platformCollectionStatus,
    platformCollectionReceivedAt:
      platformCollectionStatus === 'received'
        ? (existingRecord?.platformCollectionReceivedAt || existingRecord?.commissionPaidAt || existingRecord?.commissionCollectedAt || now)
        : null,
    platformCollectionReceivedBy:
      platformCollectionStatus === 'received'
        ? (existingRecord?.platformCollectionReceivedBy || existingRecord?.commissionPaidBy || existingRecord?.commissionCollectedBy || actorId)
        : null,
    commissionPaidAt:
      platformCollectionStatus === 'received'
        ? (existingRecord?.commissionPaidAt || existingRecord?.commissionCollectedAt || now)
        : null,
    commissionPaidBy:
      platformCollectionStatus === 'received'
        ? (existingRecord?.commissionPaidBy || existingRecord?.commissionCollectedBy || actorId)
        : null,
    commissionCollectedAt:
      platformCollectionStatus === 'received'
        ? (existingRecord?.commissionCollectedAt || existingRecord?.commissionPaidAt || now)
        : null,
    commissionCollectedBy:
      platformCollectionStatus === 'received'
        ? (existingRecord?.commissionCollectedBy || existingRecord?.commissionPaidBy || actorId)
        : null,
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    createdBy: existingRecord?.createdBy || actorId,
    updatedBy: actorId,
    notes: note || null,
    checkInCode: checkInCode || null,
    status,
  };

  return revenueRecord;
}

export async function buildBookingRevenueRecordForCreation(
  bookingId: string,
  booking: any,
  actorId: string,
  note?: string
) {
  const commissionConfig = await resolveCommissionConfig(booking);
  const providerName = await resolveProviderName(booking);
  const customerName = resolveBookingCustomerName(booking);

  return buildBookingRevenuePayload({
    bookingId,
    booking,
    checkInId: null,
    actorId,
    note,
    checkInCode: undefined,
    existingRecord: null,
    commissionConfig,
    providerName,
    customerName,
  });
}

function ensureBookingCanBeCompleted(booking: any): void {
  const status = normalizeBookingStatus(booking?.status);

  if (!status) {
    throw createServiceError('Booking is missing a valid status', 400, 'INVALID_BOOKING_STATE');
  }

  if (BOOKING_NON_REVENUE_STATUSES.has(status) || status === 'completed') {
    throw createServiceError('Booking cannot be checked in from its current state', 400, 'INVALID_BOOKING_STATE');
  }

  if (!BOOKING_COMPLETABLE_STATUSES.has(status)) {
    throw createServiceError('Booking is not eligible for backend completion yet', 400, 'INVALID_BOOKING_STATE');
  }

  if (booking?.checkedInAt || booking?.lastCheckInId || normalizeBookingStatus(booking?.attendanceStatus) === 'checked_in') {
    throw createServiceError('Booking has already been checked in', 409, 'DUPLICATE_CHECKIN');
  }
}

function ensureActorCanCompleteBooking(actor: AuthenticatedActor, booking: any): void {
  if (actor.role === UserRole.ADMIN) {
    return;
  }

  if (![UserRole.ACADEMY, UserRole.CLINIC].includes(actor.role)) {
    throw createServiceError('Only providers or admins can complete a booking', 403, 'FORBIDDEN');
  }

  if (booking?.providerId !== actor.userId) {
    throw createServiceError('You can only check in bookings for your own provider account', 403, 'FORBIDDEN');
  }
}

export async function completeBookingCheckIn(
  bookingId: string,
  actor: AuthenticatedActor,
  input: CompleteBookingCheckInInput = {}
) {
  const bookingRef = db.collection('bookings').doc(bookingId);
  const bookingDoc = await bookingRef.get();

  if (!bookingDoc.exists) {
    throw createServiceError('Booking not found', 404, 'NOT_FOUND');
  }

  const currentBooking = bookingDoc.data() || {};
  ensureActorCanCompleteBooking(actor, currentBooking);
  ensureBookingCanBeCompleted(currentBooking);

  const commissionConfig = await resolveCommissionConfig(currentBooking);
  const providerName = await resolveProviderName(currentBooking);
  const customerName = resolveBookingCustomerName(currentBooking);
  const checkInId = `booking_${bookingId}`;
  const checkInRef = db.collection('checkins').doc(checkInId);
  const revenueRef = db.collection('transactions').doc(`booking_${bookingId}`);

  let updatedBooking: any = null;
  let revenueRecord: any = null;
  let checkInRecord: any = null;

  await db.runTransaction(async (transaction) => {
    const [latestBookingDoc, checkInDoc, revenueDoc] = await Promise.all([
      transaction.get(bookingRef),
      transaction.get(checkInRef),
      transaction.get(revenueRef),
    ]);

    if (!latestBookingDoc.exists) {
      throw createServiceError('Booking not found', 404, 'NOT_FOUND');
    }

    const latestBooking = latestBookingDoc.data() || {};
    ensureActorCanCompleteBooking(actor, latestBooking);
    ensureBookingCanBeCompleted(latestBooking);

    if (checkInDoc.exists) {
      throw createServiceError('Booking has already been checked in', 409, 'DUPLICATE_CHECKIN');
    }

    const now = new Date();
    updatedBooking = {
      ...latestBooking,
      status: 'completed',
      attendanceStatus: 'checked_in',
      checkedInAt: now,
      checkedInBy: actor.userId,
      lastCheckInId: checkInId,
      lastCheckInAt: now,
      updatedAt: now,
      bookingPublicId: latestBooking?.bookingPublicId || formatBookingPublicId(bookingId),
    };

    checkInRecord = {
      bookingId,
      userId: resolveBookingCustomerId(latestBooking),
      locationId: latestBooking?.providerId || null,
      locationRole: resolveBookingType(latestBooking),
      status: 'completed',
      createdAt: now,
      createdBy: actor.userId,
      userName: customerName,
      locationName: providerName,
      source: 'backend_booking_checkin',
      meta: {
        linkedBookingId: bookingId,
        note: input.note || null,
        checkInCode: input.checkInCode || null,
        bookingPublicId: updatedBooking.bookingPublicId,
      },
    };

    revenueRecord = buildBookingRevenuePayload({
      bookingId,
      booking: updatedBooking,
      checkInId,
      actorId: actor.userId,
      note: input.note,
      checkInCode: input.checkInCode,
      existingRecord: revenueDoc.exists ? revenueDoc.data() || null : null,
      commissionConfig,
      providerName,
      customerName,
    });

    transaction.set(checkInRef, checkInRecord);
    transaction.set(revenueRef, revenueRecord, { merge: true });
    transaction.update(bookingRef, {
      status: updatedBooking.status,
      attendanceStatus: updatedBooking.attendanceStatus,
      checkedInAt: updatedBooking.checkedInAt,
      checkedInBy: updatedBooking.checkedInBy,
      lastCheckInId: updatedBooking.lastCheckInId,
      lastCheckInAt: updatedBooking.lastCheckInAt,
      updatedAt: updatedBooking.updatedAt,
      bookingPublicId: updatedBooking.bookingPublicId,
    });
  });

  return {
    booking: {
      id: bookingId,
      ...updatedBooking,
    },
    checkIn: {
      id: checkInId,
      ...checkInRecord,
    },
    revenue: {
      id: `booking_${bookingId}`,
      ...revenueRecord,
    },
  };
}

export async function syncBookingRevenueRecordIfPresent(
  bookingId: string,
  booking: any,
  actorId?: string | null,
  note?: string
) {
  const revenueRef = db.collection('transactions').doc(`booking_${bookingId}`);
  const revenueDoc = await revenueRef.get();
  if (!revenueDoc.exists) {
    return null;
  }

  const commissionConfig = await resolveCommissionConfig(booking);
  const providerName = await resolveProviderName(booking);
  const customerName = resolveBookingCustomerName(booking);
  const nextRecord = buildBookingRevenuePayload({
    bookingId,
    booking,
    checkInId: typeof booking?.lastCheckInId === 'string' ? booking.lastCheckInId : null,
    actorId: actorId || booking?.checkedInBy || booking?.providerId || 'system',
    note,
    checkInCode: revenueDoc.data()?.checkInCode || null,
    existingRecord: revenueDoc.data() || null,
    commissionConfig,
    providerName,
    customerName,
  });

  await revenueRef.set(nextRecord, { merge: true });
  return { id: revenueRef.id, ...nextRecord };
}

export async function listRevenueRecords(filters: RevenueListFilters) {
  let query: any = db.collection('transactions');
  if (filters.source && filters.source !== 'all') {
    query = query.where('revenueSource', '==', filters.source);
  }

  const snapshot = await query.get();
  const allRecords = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const filteredRecords = allRecords
    .filter((record: any) => {
      if (filters.providerId && String(record.providerId || '') !== filters.providerId) return false;
      if (filters.bookingId && String(record.bookingId || '') !== filters.bookingId) return false;

      const platformStatus = resolvePlatformCollectionStatus(record);
      if (filters.platformStatus && filters.platformStatus !== 'all' && platformStatus !== filters.platformStatus) {
        return false;
      }

      return true;
    })
    .map((record: any) => ({
      ...record,
      platformCollectionStatus: resolvePlatformCollectionStatus(record),
    }))
    .sort((left: any, right: any) => getDateValue(right.updatedAt || right.createdAt).getTime() - getDateValue(left.updatedAt || left.createdAt).getTime());

  const startIndex = (filters.page - 1) * filters.limit;
  const records = filteredRecords.slice(startIndex, startIndex + filters.limit);

  return {
    records,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: filteredRecords.length,
      totalPages: Math.ceil(filteredRecords.length / filters.limit) || 1,
    },
  };
}

export async function summarizeRevenue(filters: RevenueSummaryFilters) {
  const { records } = await listRevenueRecords({ ...filters, page: 1, limit: 100000 });

  return records.reduce(
    (summary: any, record: any) => {
      const platformStatus = resolvePlatformCollectionStatus(record);
      const revenueAmount = asNumber(record.platformRevenueAmount, 0);
      const bookingAmount = asNumber(record.bookingAmount ?? record.grossAmount, 0);
      const providerNetAmount = asNumber(record.providerNetAmount, 0);

      summary.totalRecords += 1;
      summary.totalBookingAmount = roundMoney(summary.totalBookingAmount + bookingAmount);
      summary.totalPlatformRevenue = roundMoney(summary.totalPlatformRevenue + revenueAmount);
      summary.totalProviderNet = roundMoney(summary.totalProviderNet + providerNetAmount);

      if (platformStatus === 'received') {
        summary.totalReceived = roundMoney(summary.totalReceived + revenueAmount);
      } else if (platformStatus === 'due') {
        summary.totalDue = roundMoney(summary.totalDue + revenueAmount);
      } else if (platformStatus === 'cancelled') {
        summary.totalCancelled = roundMoney(summary.totalCancelled + revenueAmount);
      }

      return summary;
    },
    {
      totalRecords: 0,
      totalBookingAmount: 0,
      totalPlatformRevenue: 0,
      totalProviderNet: 0,
      totalReceived: 0,
      totalDue: 0,
      totalCancelled: 0,
    }
  );
}

export async function markRevenueAsReceived(transactionId: string, actorId: string) {
  const revenueRef = db.collection('transactions').doc(transactionId);
  const revenueDoc = await revenueRef.get();

  if (!revenueDoc.exists) {
    throw createServiceError('Revenue record not found', 404, 'NOT_FOUND');
  }

  const currentRecord = revenueDoc.data() || {};
  const revenueAmount = asNumber(currentRecord.platformRevenueAmount, 0);
  if (revenueAmount <= 0) {
    throw createServiceError('This revenue record has no platform commission to collect', 400, 'INVALID_REVENUE_STATE');
  }

  if (resolvePlatformCollectionStatus(currentRecord) === 'received') {
    return { id: transactionId, ...currentRecord, platformCollectionStatus: 'received' };
  }

  const now = new Date();
  const nextRecord = {
    platformCollectionStatus: 'received',
    platformCollectionReceivedAt: now,
    platformCollectionReceivedBy: actorId,
    commissionPaymentStatus: 'paid',
    commissionCollectionStatus: 'collected',
    commissionPaidAt: now,
    commissionPaidBy: actorId,
    commissionCollectedAt: now,
    commissionCollectedBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  };

  await revenueRef.set(nextRecord, { merge: true });
  return { id: transactionId, ...currentRecord, ...nextRecord };
}

export function getRevenueSourceFromRecord(record: any): RevenueSource | 'unknown' {
  return normalizeRevenueSource(record?.revenueSource);
}