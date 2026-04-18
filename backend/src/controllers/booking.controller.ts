import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { sendSuccess, sendError } from '../utils/response.util';
import { createNotificationsForUsers, getAdminUserIds } from '../utils/notification.util';
import { z } from 'zod';
import { BookingStatus, BookingType, UserRole } from '../types';
import {
  buildBookingRevenueRecordForCreation,
  completeBookingCheckIn,
  syncBookingRevenueRecordIfPresent,
} from '../services/revenue.service';

const BOOKING_FINAL_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCELLED,
  BookingStatus.REJECTED,
  BookingStatus.COMPLETED,
]);

const PROVIDER_STATUS_UPDATES = new Set<BookingStatus>([
  BookingStatus.ACCEPTED,
  BookingStatus.REJECTED,
]);

const ACTIVE_BOOKING_STATUSES = new Set([
  'pending',
  'requested',
  'accepted',
  'confirmed',
  'player_accepted',
  'new_time_proposed',
  'timing_proposed',
]);

const DUPLICATE_BOOKING_WINDOW_MINUTES = 15;

const BOOKING_CREATOR_ROLES = new Set<UserRole>([
  UserRole.PLAYER,
  UserRole.PARENT,
  UserRole.ACADEMY,
]);

function normalizeDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function isPastBookingDate(date: string): boolean {
  const bookingDate = normalizeDateOnly(date);
  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return bookingDate.getTime() < utcToday.getTime();
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLooseKey(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/[\s_-]+/g, '');
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getUserDisplayName(data: any): string | null {
  const candidates = [
    data?.name,
    data?.playerName,
    data?.parentName,
    data?.academyName,
    data?.clinicName,
    [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim(),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeBookingDateInput(value: string): string | null {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return Number.isNaN(new Date(`${trimmed}T00:00:00.000Z`).getTime()) ? null : trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().split('T')[0];
}

function normalizeBookingType(value: unknown): BookingType | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === BookingType.ACADEMY) return BookingType.ACADEMY;
  if (normalized === BookingType.CLINIC) return BookingType.CLINIC;
  return null;
}

async function ensureAdminBookingNotifications(params: {
  bookingId: string;
  bookingType: BookingType;
  providerId: string;
  providerName: string;
  customerName: string;
  normalizedDate: string;
  time?: string | null;
  createdBy: string;
}) {
  const adminIds = await getAdminUserIds();
  const missingAdminIds: string[] = [];

  await Promise.all(
    adminIds.map(async (adminId) => {
      const existing = await db
        .collection('notifications')
        .where('userId', '==', adminId)
        .where('type', '==', 'booking')
        .where('data.bookingId', '==', params.bookingId)
        .limit(1)
        .get();

      if (!existing.empty) {
        return;
      }

      missingAdminIds.push(adminId);
    })
  );

  if (missingAdminIds.length === 0) {
    return;
  }

  await createNotificationsForUsers(missingAdminIds, {
    title: 'New booking request',
    body: `${params.customerName || 'A customer'} requested a ${params.bookingType} booking with ${params.providerName} for ${params.normalizedDate}${params.time ? ` at ${params.time}` : ''}.`,
    type: 'booking',
    data: { bookingId: params.bookingId, providerId: params.providerId, status: 'pending' },
    createdBy: params.createdBy,
  });
}

function queueBookingNotifications(params: {
  bookingId: string;
  bookingType: BookingType;
  providerId: string;
  providerName: string;
  customerName: string;
  normalizedDate: string;
  time?: string | null;
  createdBy: string;
  notifyBookerUserId?: string | null;
  isDuplicate?: boolean;
}) {
  void (async () => {
    try {
      await createNotificationsForUsers([params.providerId], {
        title: 'New booking request',
        body: `You have received a new booking request for ${params.normalizedDate}${params.time ? ` at ${params.time}` : ''}.`,
        type: 'booking',
        data: { bookingId: params.bookingId, status: 'pending' },
        createdBy: params.createdBy,
      });
    } catch (notifError) {
      console.error('Failed to notify provider about booking:', notifError);
    }

    try {
      await ensureAdminBookingNotifications({
        bookingId: params.bookingId,
        bookingType: params.bookingType,
        providerId: params.providerId,
        providerName: params.providerName,
        customerName: params.customerName || 'Customer',
        normalizedDate: params.normalizedDate,
        time: params.time,
        createdBy: params.createdBy,
      });
    } catch (notifError) {
      console.error('Failed to notify admins about booking:', notifError);
    }

    if (!params.isDuplicate && params.notifyBookerUserId) {
      try {
        await createNotificationsForUsers([params.notifyBookerUserId], {
          title: 'Booking request sent',
          body: `Your booking request has been sent and is pending approval.`,
          type: 'booking',
          data: { bookingId: params.bookingId, status: 'pending' },
          createdBy: params.createdBy,
        });
      } catch (notifError) {
        console.error('Failed to notify booker:', notifError);
      }
    }
  })();
}

function resolveCustomerFields(actor: Express.Request['user'], input: any, actorProfile: any) {
  const customerName =
    normalizeText(input.customerName) ||
    normalizeText(input.playerName) ||
    normalizeText(input.parentName) ||
    getUserDisplayName(actorProfile) ||
    'Customer';

  if (!actor) {
    throw new Error('Authentication required');
  }

  if (actor.role === UserRole.PLAYER) {
    const playerId = normalizeText(input.playerId) || actor.userId;
    const parentId = normalizeText(input.parentId) || actor.userId;
    if (playerId !== actor.userId) {
      throw new Error('Players can only create bookings for themselves');
    }

    return {
      userId: actor.userId,
      playerId,
      parentId,
      academyId: null,
      playerName: normalizeText(input.playerName) || customerName,
      parentName: normalizeText(input.parentName) || customerName,
      customerName,
    };
  }

  if (actor.role === UserRole.PARENT) {
    const parentId = normalizeText(input.parentId) || actor.userId;
    if (parentId !== actor.userId) {
      throw new Error('Parents can only create bookings for themselves');
    }

    return {
      userId: actor.userId,
      playerId: normalizeText(input.playerId) || null,
      parentId,
      academyId: null,
      playerName: normalizeText(input.playerName) || null,
      parentName: normalizeText(input.parentName) || customerName,
      customerName,
    };
  }

  if (actor.role === UserRole.ACADEMY) {
    const academyId = normalizeText(input.academyId) || actor.userId;
    if (academyId !== actor.userId) {
      throw new Error('Academies can only create clinic bookings for their own account');
    }

    return {
      userId: actor.userId,
      playerId: null,
      parentId: null,
      academyId,
      playerName: null,
      parentName: null,
      customerName,
    };
  }

  throw new Error('Your account role cannot create bookings through this endpoint');
}

function resolveClinicServicePrice(providerProfile: any, providerUser: any, serviceName: string, fallbackPrice: number): number {
  const normalizedServiceName = normalizeLooseKey(serviceName);
  const sources = [providerProfile?.services, providerUser?.services];

  for (const source of sources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      const exact = source.find((item: any) => normalizeLooseKey(item?.name) === normalizedServiceName);
      if (exact) {
        return roundMoney(asNumber(exact?.fee ?? exact?.price, fallbackPrice));
      }
    }

    if (typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        const normalizedKey = normalizeLooseKey(key);
        const normalizedLabel = normalizeLooseKey(String(key).replace(/_/g, ' '));
        if (normalizedServiceName && normalizedServiceName !== normalizedKey && normalizedServiceName !== normalizedLabel) {
          continue;
        }

        const record: any = value || {};
        if (record.selected === false) {
          continue;
        }

        return roundMoney(asNumber(record.fee ?? record.price, fallbackPrice));
      }
    }
  }

  return roundMoney(fallbackPrice);
}

function sameCustomer(booking: any, candidateIds: string[]) {
  const existingIds = [booking?.userId, booking?.playerId, booking?.parentId, booking?.academyId]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => String(value));

  return candidateIds.some((id) => existingIds.includes(id));
}

function getDateMilliseconds(value: any): number {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isWithinDuplicateWindow(existing: any, bookingData: any) {
  const duplicateWindowMs = DUPLICATE_BOOKING_WINDOW_MINUTES * 60 * 1000;
  const existingCreatedAt = getDateMilliseconds(existing?.createdAt || existing?.updatedAt);
  const incomingCreatedAt = getDateMilliseconds(bookingData?.createdAt);

  if (!existingCreatedAt || !incomingCreatedAt) {
    return false;
  }

  return Math.abs(incomingCreatedAt - existingCreatedAt) <= duplicateWindowMs;
}

function isSameBranch(existing: any, bookingData: any) {
  const existingBranchKey =
    normalizeText(existing?.branchId) ||
    normalizeLooseKey(existing?.branchName) ||
    normalizeLooseKey(existing?.branchAddress);
  const incomingBranchKey =
    normalizeText(bookingData?.branchId) ||
    normalizeLooseKey(bookingData?.branchName) ||
    normalizeLooseKey(bookingData?.branchAddress);

  if (!existingBranchKey || !incomingBranchKey) {
    return true;
  }

  return existingBranchKey === incomingBranchKey;
}

function isMatchingActiveBooking(existing: any, bookingData: any, candidateCustomerIds: string[]) {
  if (!ACTIVE_BOOKING_STATUSES.has(normalizeText(existing?.status).toLowerCase())) {
    return false;
  }

  if (!sameCustomer(existing, candidateCustomerIds)) {
    return false;
  }

  if (!isWithinDuplicateWindow(existing, bookingData)) {
    return false;
  }

  if (!isSameBranch(existing, bookingData)) {
    return false;
  }

  const sameProgram = normalizeText(existing?.programId) === normalizeText(bookingData?.programId);
  const sameService = normalizeLooseKey(existing?.service) === normalizeLooseKey(bookingData?.service);
  const sameTime = normalizeText(existing?.time) === normalizeText(bookingData?.time);
  const sameSessionType = normalizeText(existing?.sessionType) === normalizeText(bookingData?.sessionType);
  const sameAgeGroup = normalizeText(existing?.ageGroup) === normalizeText(bookingData?.ageGroup);

  if (bookingData?.programId) {
    return sameProgram;
  }

  if (bookingData?.service) {
    return sameService && sameTime;
  }

  return sameSessionType && sameAgeGroup;
}

function normalizeGuardKeyPart(value: unknown): string {
  const normalized = normalizeLooseKey(value);
  return normalized || 'na';
}

function buildBranchGuardKey(bookingData: any): string {
  return (
    normalizeText(bookingData?.branchId) ||
    normalizeLooseKey(bookingData?.branchName) ||
    normalizeLooseKey(bookingData?.branchAddress) ||
    'any'
  );
}

function buildDuplicateGuardId(providerId: string, normalizedDate: string, bookingData: any, candidateCustomerIds: string[]): string {
  const customerKey = [...new Set(candidateCustomerIds.map((value) => normalizeGuardKeyPart(value)))].sort().join('_') || 'anonymous';
  const branchKey = normalizeGuardKeyPart(buildBranchGuardKey(bookingData));
  const offeringKey = bookingData?.programId
    ? `program_${normalizeGuardKeyPart(bookingData.programId)}`
    : bookingData?.service
      ? `service_${normalizeGuardKeyPart(bookingData.service)}_${normalizeGuardKeyPart(bookingData.time)}`
      : `session_${normalizeGuardKeyPart(bookingData.sessionType)}_${normalizeGuardKeyPart(bookingData.ageGroup)}`;

  return [
    'dup',
    normalizeGuardKeyPart(providerId),
    normalizeGuardKeyPart(normalizedDate),
    customerKey,
    branchKey,
    offeringKey,
  ].join('__');
}

function buildSlotGuardId(providerId: string, normalizedDate: string, bookingData: any): string {
  return [
    'slot',
    normalizeGuardKeyPart(providerId),
    normalizeGuardKeyPart(normalizedDate),
    normalizeGuardKeyPart(buildBranchGuardKey(bookingData)),
    normalizeGuardKeyPart(bookingData?.time),
  ].join('__');
}

function getDuplicateGuardRef(providerId: string, normalizedDate: string, bookingData: any, candidateCustomerIds: string[]) {
  return db.collection('booking_request_guards').doc(buildDuplicateGuardId(providerId, normalizedDate, bookingData, candidateCustomerIds));
}

function getSlotGuardRef(providerId: string, normalizedDate: string, bookingData: any) {
  if (!normalizeText(bookingData?.time)) {
    return null;
  }

  return db.collection('booking_slot_guards').doc(buildSlotGuardId(providerId, normalizedDate, bookingData));
}

async function syncBookingGuardState(bookingId: string, bookingData: any): Promise<void> {
  const candidateCustomerIds = [
    bookingData?.userId,
    bookingData?.playerId,
    bookingData?.parentId,
    bookingData?.academyId,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (!bookingData?.providerId || !bookingData?.date) {
    return;
  }

  const duplicateGuardRef = getDuplicateGuardRef(String(bookingData.providerId), String(bookingData.date), bookingData, candidateCustomerIds);
  const slotGuardRef = getSlotGuardRef(String(bookingData.providerId), String(bookingData.date), bookingData);
  const normalizedStatus = normalizeText(bookingData?.status).toLowerCase();
  const isActive = ACTIVE_BOOKING_STATUSES.has(normalizedStatus);

  const writes: Array<Promise<unknown>> = [];

  writes.push(
    duplicateGuardRef.set(
      {
        bookingId,
        providerId: bookingData?.providerId || null,
        date: bookingData?.date || null,
        status: normalizedStatus || null,
        updatedAt: new Date(),
      },
      { merge: true }
    )
  );

  if (slotGuardRef) {
    if (isActive) {
      writes.push(
        slotGuardRef.set(
          {
            bookingId,
            providerId: bookingData?.providerId || null,
            date: bookingData?.date || null,
            time: bookingData?.time || null,
            branchId: bookingData?.branchId || null,
            status: normalizedStatus || null,
            updatedAt: new Date(),
          },
          { merge: true }
        )
      );
    } else {
      writes.push(slotGuardRef.delete().catch(() => undefined));
    }
  }

  await Promise.all(writes);
}

function canTransitionBookingStatus(currentStatus: BookingStatus, nextStatus: BookingStatus): boolean {
  if (currentStatus === BookingStatus.REQUESTED) {
    return nextStatus === BookingStatus.ACCEPTED || nextStatus === BookingStatus.REJECTED;
  }

  return false;
}

// Validation schemas
const createBookingSchema = z.object({
  providerId: z.string().min(1),
  providerName: z.string().optional(),
  type: z.string().optional(),
  bookingType: z.string().optional(),
  serviceId: z.string().optional(),
  service: z.string().optional(),
  programId: z.string().optional(),
  program: z.string().optional(),
  ageGroup: z.string().optional(),
  sessionType: z.string().optional(),
  doctor: z.string().optional(),
  coachName: z.string().optional(),
  date: z.string().min(1),
  time: z.string().nullable().optional(),
  preferredTime: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  duration: z.number().optional(),
  shift: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  day: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  branchAddress: z.string().nullable().optional(),
  customerName: z.string().optional(),
  playerId: z.string().optional(),
  parentId: z.string().optional(),
  academyId: z.string().optional(),
  playerName: z.string().optional(),
  parentName: z.string().optional(),
  name: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([BookingStatus.ACCEPTED, BookingStatus.REJECTED]),
});

const completeBookingCheckInSchema = z.object({
  note: z.string().trim().max(500).nullish().transform((value) => value ?? undefined),
  checkInCode: z.string().trim().max(120).nullish().transform((value) => value ?? undefined),
});

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 */
export async function createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const validatedData = createBookingSchema.parse(req.body);
    const bookingType = normalizeBookingType(validatedData.type || validatedData.bookingType);
    const providerId = validatedData.providerId;

    if (!bookingType) {
      sendError(res, 'VALIDATION_ERROR', 'Booking type must be academy or clinic', null, 400);
      return;
    }

    if (!BOOKING_CREATOR_ROLES.has(req.user.role)) {
      sendError(res, 'FORBIDDEN', 'Your account role cannot create bookings through this endpoint', null, 403);
      return;
    }

    if (providerId === req.user.userId) {
      sendError(res, 'VALIDATION_ERROR', 'You cannot book yourself as a provider', null, 400);
      return;
    }

    const normalizedDate = normalizeBookingDateInput(validatedData.date);
    if (!normalizedDate) {
      sendError(res, 'VALIDATION_ERROR', 'Booking date is invalid', null, 400);
      return;
    }

    if (isPastBookingDate(normalizedDate)) {
      sendError(res, 'VALIDATION_ERROR', 'Booking date cannot be in the past', null, 400);
      return;
    }

    const providerUserDoc = await db.collection('users').doc(providerId).get();
    if (!providerUserDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Provider not found', null, 404);
      return;
    }

    const providerUserData = providerUserDoc.data() || {};
    if (normalizeText(providerUserData.role).toLowerCase() !== bookingType) {
      sendError(res, 'VALIDATION_ERROR', `Provider must be of type ${bookingType}`, null, 400);
      return;
    }

    const providerCollection = bookingType === BookingType.ACADEMY ? 'academies' : 'clinics';
    const providerProfileDoc = await db.collection(providerCollection).doc(providerId).get();
    const providerProfileData = providerProfileDoc.exists ? providerProfileDoc.data() || {} : {};
    const actorUserDoc = await db.collection('users').doc(req.user.userId).get();
    const actorUserData = actorUserDoc.exists ? actorUserDoc.data() || {} : {};

    let customerFields: ReturnType<typeof resolveCustomerFields>;
    try {
      customerFields = resolveCustomerFields(req.user, validatedData, actorUserData);
    } catch (error: any) {
      sendError(res, 'FORBIDDEN', error.message || 'Invalid booking ownership', null, 403);
      return;
    }

    let resolvedPrice = roundMoney(asNumber(validatedData.price, NaN));
    if (!Number.isFinite(resolvedPrice) || resolvedPrice < 0) {
      sendError(res, 'VALIDATION_ERROR', 'Booking price is invalid', null, 400);
      return;
    }

    let resolvedProgramId = normalizeText(validatedData.programId) || null;
    let resolvedProgramName = normalizeText(validatedData.program) || null;
    let resolvedCoachName = normalizeText(validatedData.coachName) || null;
    let resolvedDuration = typeof validatedData.duration === 'number' ? validatedData.duration : null;
    let resolvedBranchId = normalizeText(validatedData.branchId) || null;
    let resolvedBranchName = normalizeText(validatedData.branchName) || null;
    let resolvedBranchAddress = normalizeText(validatedData.branchAddress) || null;
    const normalizedSessionType = normalizeText(validatedData.sessionType) || null;

    if (bookingType === BookingType.ACADEMY && normalizedSessionType === 'private') {
      if (!resolvedProgramId) {
        sendError(res, 'VALIDATION_ERROR', 'Private training bookings require a program', null, 400);
        return;
      }

      const programDoc = await db.collection('academy_programs').doc(resolvedProgramId).get();
      if (!programDoc.exists) {
        sendError(res, 'NOT_FOUND', 'Academy program not found', null, 404);
        return;
      }

      const programData = programDoc.data() || {};
      if (normalizeText(programData.academyId) !== providerId) {
        sendError(res, 'VALIDATION_ERROR', 'Program does not belong to this academy', null, 400);
        return;
      }

      if (programData.isActive === false) {
        sendError(res, 'VALIDATION_ERROR', 'Program is not available for booking', null, 400);
        return;
      }

      resolvedProgramName = normalizeText(programData.name) || resolvedProgramName;
      resolvedCoachName = normalizeText(programData.coachName) || resolvedCoachName;
      resolvedDuration = asNumber(programData.duration, resolvedDuration ?? 0) || resolvedDuration;
      resolvedPrice = roundMoney(asNumber(programData.fee, resolvedPrice));
      resolvedBranchId = normalizeText(programData.branchId) || resolvedBranchId;
      resolvedBranchName = normalizeText(programData.branchName) || resolvedBranchName;
      resolvedBranchAddress = normalizeText(programData.branchAddress) || resolvedBranchAddress;
    } else if (bookingType === BookingType.ACADEMY && normalizeText(validatedData.ageGroup)) {
      const ageGroup = normalizeText(validatedData.ageGroup);
      const providerFees = providerProfileData?.fees || providerUserData?.fees || {};
      const agePrice = asNumber(providerFees?.[ageGroup], NaN);
      if (Number.isFinite(agePrice) && agePrice >= 0) {
        resolvedPrice = roundMoney(agePrice);
      }
    } else if (bookingType === BookingType.CLINIC) {
      resolvedPrice = resolveClinicServicePrice(
        providerProfileData,
        providerUserData,
        normalizeText(validatedData.service),
        resolvedPrice
      );
    }

    const providerName =
      normalizeText(validatedData.providerName) ||
      getUserDisplayName(providerProfileData) ||
      getUserDisplayName(providerUserData) ||
      'Provider';

    const bookingRef = db.collection('bookings').doc();
    const createdAt = new Date();
    const bookingData = {
      userId: req.user.userId,
      playerId: customerFields.playerId,
      parentId: customerFields.parentId,
      academyId: customerFields.academyId,
      playerName: customerFields.playerName,
      parentName: customerFields.parentName,
      customerName: customerFields.customerName,
      providerId,
      providerName,
      bookingType,
      type: bookingType,
      serviceId: normalizeText(validatedData.serviceId) || null,
      service: normalizeText(validatedData.service) || null,
      programId: resolvedProgramId,
      program: resolvedProgramName,
      ageGroup: normalizeText(validatedData.ageGroup) || null,
      sessionType: normalizedSessionType,
      doctor: normalizeText(validatedData.doctor) || null,
      coachName: resolvedCoachName,
      date: normalizedDate,
      time: normalizeText(validatedData.time) || null,
      preferredTime: normalizeText(validatedData.preferredTime) || null,
      status: 'pending',
      price: resolvedPrice,
      notes: normalizeText(validatedData.notes) || null,
      comments: normalizeText(validatedData.comments) || null,
      shift: normalizeText(validatedData.shift) || null,
      day: normalizeText(validatedData.day) || null,
      duration: resolvedDuration,
      branchId: resolvedBranchId,
      branchName: resolvedBranchName,
      branchAddress: resolvedBranchAddress,
      city: normalizeText(validatedData.city) || normalizeText(providerProfileData.city) || normalizeText(providerUserData.city) || null,
      name: normalizeText(validatedData.name) || providerName,
      bookingPublicId: `BK-${bookingRef.id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-8).padStart(8, '0')}`,
      createdAt,
      updatedAt: createdAt,
    };

    const revenueData = await buildBookingRevenueRecordForCreation(
      bookingRef.id,
      bookingData,
      req.user.userId,
      normalizeText(validatedData.reason) || 'Booking created'
    );

    const revenueRef = db.collection('transactions').doc(`booking_${bookingRef.id}`);
    const candidateCustomerIds = [
      bookingData.userId,
      bookingData.playerId,
      bookingData.parentId,
      bookingData.academyId,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    let existingDuplicateBooking: { id: string; [key: string]: any } | null = null;
    const duplicateGuardRef = getDuplicateGuardRef(providerId, normalizedDate, bookingData, candidateCustomerIds);
    const slotGuardRef = getSlotGuardRef(providerId, normalizedDate, bookingData);

    await db.runTransaction(async (transaction) => {
      const duplicateGuardDoc = await transaction.get(duplicateGuardRef);
      if (duplicateGuardDoc.exists) {
        const duplicateGuardData = duplicateGuardDoc.data() || {};
        const existingBookingId = normalizeText(duplicateGuardData.bookingId);
        if (existingBookingId) {
          const existingBookingDoc = await transaction.get(db.collection('bookings').doc(existingBookingId));
          if (existingBookingDoc.exists) {
            const existing = existingBookingDoc.data() || {};
            if (isMatchingActiveBooking(existing, bookingData, candidateCustomerIds)) {
              existingDuplicateBooking = {
                id: existingBookingDoc.id,
                ...existing,
              };
              return;
            }
          }
        }
      }

      if (slotGuardRef) {
        const slotGuardDoc = await transaction.get(slotGuardRef);
        if (slotGuardDoc.exists) {
          const slotGuardData = slotGuardDoc.data() || {};
          const existingBookingId = normalizeText(slotGuardData.bookingId);
          if (existingBookingId) {
            const existingBookingDoc = await transaction.get(db.collection('bookings').doc(existingBookingId));
            if (existingBookingDoc.exists) {
              const existing = existingBookingDoc.data() || {};
              if (
                ACTIVE_BOOKING_STATUSES.has(normalizeText(existing.status).toLowerCase()) &&
                isSameBranch(existing, bookingData) &&
                normalizeText(existing.time) === normalizeText(bookingData.time)
              ) {
                const error = new Error('Time slot already booked');
                (error as any).statusCode = 409;
                throw error;
              }
            }
          }
        }
      }

      transaction.set(bookingRef, bookingData);
      transaction.set(revenueRef, revenueData, { merge: true });
      transaction.set(duplicateGuardRef, {
        bookingId: bookingRef.id,
        providerId,
        date: normalizedDate,
        status: bookingData.status,
        updatedAt: createdAt,
      }, { merge: true });

      if (slotGuardRef) {
        transaction.set(slotGuardRef, {
          bookingId: bookingRef.id,
          providerId,
          date: normalizedDate,
          time: bookingData.time,
          branchId: bookingData.branchId || null,
          status: bookingData.status,
          updatedAt: createdAt,
        }, { merge: true });
      }
    });

    const duplicateBookingResult = existingDuplicateBooking as ({ id: string; [key: string]: any }) | null;

    if (duplicateBookingResult) {
      sendSuccess(
        res,
        {
          ...duplicateBookingResult,
          isDuplicate: true,
        },
        'Matching booking request already existed',
        200
      );

      queueBookingNotifications({
        bookingId: duplicateBookingResult.id,
        bookingType,
        providerId,
        providerName,
        customerName: bookingData.customerName || 'Customer',
        normalizedDate,
        time: bookingData.time,
        createdBy: req.user!.userId,
        notifyBookerUserId: null,
        isDuplicate: true,
      });

      return;
    }

    sendSuccess(
      res,
      {
        id: bookingRef.id,
        ...bookingData,
      },
      'Booking created successfully',
      201
    );

    queueBookingNotifications({
      bookingId: bookingRef.id,
      bookingType,
      providerId,
      providerName,
      customerName: bookingData.customerName || 'Customer',
      normalizedDate,
      time: bookingData.time,
      createdBy: req.user!.userId,
      notifyBookerUserId: req.user!.userId,
      isDuplicate: false,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    if (error?.message === 'Time slot already booked') {
      sendError(res, 'CONFLICT', 'Time slot already booked', null, 409);
      return;
    }
    if (typeof error?.message === 'string' && error.message.startsWith('Provider must be of type')) {
      sendError(res, 'VALIDATION_ERROR', error.message, null, 400);
      return;
    }
    next(error);
  }
}

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Get user's bookings
 */
export async function getBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { status, type } = req.query;
    let query = db.collection('bookings').where('userId', '==', req.user.userId);

    if (status) {
      query = query.where('status', '==', status);
    }

    if (type) {
      query = query.where('bookingType', '==', type);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const bookings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    sendSuccess(res, bookings, 'Bookings retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 */
export async function getBookingById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { id } = req.params;
    const bookingDoc = await db.collection('bookings').doc(id).get();

    if (!bookingDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Booking not found', null, 404);
      return;
    }

    const bookingData = bookingDoc.data();
    // Check if user owns this booking, is the provider, or is admin
    if (
      bookingData?.userId !== req.user.userId &&
      bookingData?.providerId !== req.user.userId &&
      req.user.role !== UserRole.ADMIN
    ) {
      sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
      return;
    }

    sendSuccess(
      res,
      {
        id: bookingDoc.id,
        ...bookingData,
      },
      'Booking retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /api/bookings/{id}/status:
 *   put:
 *     summary: Update booking status
 */
export async function updateBookingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { id } = req.params;
    const validatedData = updateStatusSchema.parse(req.body);
    const { status } = validatedData;

    const bookingDoc = await db.collection('bookings').doc(id).get();

    if (!bookingDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Booking not found', null, 404);
      return;
    }

    const bookingData = bookingDoc.data();

    // Only provider can update status
    if (bookingData?.providerId !== req.user.userId) {
      sendError(res, 'FORBIDDEN', 'Only provider can update booking status', null, 403);
      return;
    }

    // Validate status transition
    const currentStatus = bookingData?.status;
    if (!PROVIDER_STATUS_UPDATES.has(status as BookingStatus) || !canTransitionBookingStatus(currentStatus as BookingStatus, status as BookingStatus)) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid booking status transition', null, 400);
      return;
    }

    // Update booking
    await db.collection('bookings').doc(id).update({
      status: status as BookingStatus,
      updatedAt: new Date(),
    });

    const updatedDoc = await db.collection('bookings').doc(id).get();
    const updatedBooking = updatedDoc.data();
    if (updatedBooking) {
      await syncBookingGuardState(id, updatedBooking);
      await syncBookingRevenueRecordIfPresent(
        id,
        updatedBooking,
        req.user.userId,
        `Booking status changed to ${String(status).toLowerCase()} by provider`
      );
    }

    // Notify the booker about status change
    const bookerId = bookingData?.userId as string;
    const statusMessages: Record<string, { title: string; body: string }> = {
      [BookingStatus.ACCEPTED]: { title: 'Booking accepted', body: 'Your booking request has been accepted.' },
      [BookingStatus.REJECTED]: { title: 'Booking rejected', body: 'Your booking request was declined.' },
    };
    const msg = statusMessages[status];
    if (bookerId && msg) {
      createNotificationsForUsers([bookerId], {
        title: msg.title,
        body: msg.body,
        type: 'booking',
        data: { bookingId: id, status },
        createdBy: req.user!.userId,
      }).catch((err) => console.error('Booking status notification failed:', err));
    }

    sendSuccess(
      res,
      {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
      'Booking status updated successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    next(error);
  }
}

/**
 * @swagger
 * /api/bookings/{id}/cancel:
 *   put:
 *     summary: Cancel booking
 */
export async function cancelBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { id } = req.params;
    const bookingDoc = await db.collection('bookings').doc(id).get();

    if (!bookingDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Booking not found', null, 404);
      return;
    }

    const bookingData = bookingDoc.data();

    // User, provider, or admin can cancel
    if (
      bookingData?.userId !== req.user.userId &&
      bookingData?.providerId !== req.user.userId &&
      req.user.role !== UserRole.ADMIN
    ) {
      sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
      return;
    }

    // Cannot cancel already cancelled or completed bookings
    if (BOOKING_FINAL_STATUSES.has(bookingData?.status as BookingStatus)) {
      sendError(res, 'VALIDATION_ERROR', 'Booking is already cancelled or completed', null, 400);
      return;
    }

    // Update booking
    await db.collection('bookings').doc(id).update({
      status: BookingStatus.CANCELLED,
      updatedAt: new Date(),
    });

    // Notify the other party about cancellation (booker or provider)
    const bookerId = bookingData?.userId as string;
    const providerId = bookingData?.providerId as string;
    const notifyUserId = req.user!.userId === bookerId ? providerId : bookerId;
    if (notifyUserId) {
      createNotificationsForUsers([notifyUserId], {
        title: 'Booking cancelled',
        body: 'A booking has been cancelled.',
        type: 'booking',
        data: { bookingId: id, status: 'cancelled' },
        createdBy: req.user!.userId,
      }).catch((err) => console.error('Booking cancel notification failed:', err));
    }

    const updatedDoc = await db.collection('bookings').doc(id).get();
    const updatedBooking = updatedDoc.data();
    if (updatedBooking) {
      await syncBookingGuardState(id, updatedBooking);
      await syncBookingRevenueRecordIfPresent(
        id,
        updatedBooking,
        req.user.userId,
        'Booking cancelled before completion'
      );
    }

    sendSuccess(
      res,
      {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
      'Booking cancelled successfully'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /api/bookings/provider:
 *   get:
 *     summary: Get provider's bookings
 */
export async function getProviderBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { status } = req.query;
    if (![UserRole.ACADEMY, UserRole.CLINIC, UserRole.ADMIN].includes(req.user.role)) {
      sendError(res, 'FORBIDDEN', 'Only providers can access provider bookings', null, 403);
      return;
    }

    let query = db.collection('bookings').where('providerId', '==', req.user.userId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const bookings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    sendSuccess(res, bookings, 'Provider bookings retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /api/bookings/{id}/check-in:
 *   post:
 *     summary: Complete a booking attendance and create backend revenue record
 */
export async function checkInBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { id } = req.params;
    const validated = completeBookingCheckInSchema.parse(req.body || {});
    const result = await completeBookingCheckIn(
      id,
      {
        userId: req.user.userId,
        role: req.user.role,
      },
      validated
    );

    const bookerId = typeof result.booking.userId === 'string' ? result.booking.userId : null;
    if (bookerId) {
      createNotificationsForUsers([bookerId], {
        title: 'Booking completed',
        body: 'Your booking attendance has been verified and completed.',
        type: 'checkin',
        data: {
          bookingId: id,
          checkInId: result.checkIn.id,
          transactionId: result.revenue.id,
        },
        createdBy: req.user.userId,
      }).catch((error) => console.error('Booking completion notification failed:', error));
    }

    sendSuccess(res, result, 'Booking check-in completed successfully', 200);
  } catch (error: any) {
    console.error('[booking.checkInBooking] Failed to complete booking check-in', {
      bookingId: req.params?.id,
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      statusCode: error?.statusCode,
      code: error?.code,
      message: error?.message,
      details: error?.errors,
    });

    if (error?.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }

    if (typeof error?.statusCode === 'number' && typeof error?.code === 'string') {
      sendError(res, error.code, error.message, null, error.statusCode);
      return;
    }

    next(error);
  }
}

// Schema for proposing a booking change (admin -> user)
const proposeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().optional(),
  message: z.string().optional(),
});

/**
 * POST /api/bookings/:id/propose
 * Admin proposes a new date/time for a booking. Creates a proposal doc
 * under bookings/{id}/proposals and notifies the booking owner.
 */
export async function proposeBookingChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    // Only admins can propose changes via this endpoint
    if (req.user.role !== UserRole.ADMIN) {
      sendError(res, 'FORBIDDEN', 'Only admins can propose booking changes', null, 403);
      return;
    }

    const { id } = req.params;
    const validated = proposeSchema.parse(req.body);

    const bookingRef = db.collection('bookings').doc(id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Booking not found', null, 404);
      return;
    }

    const bookingData = bookingDoc.data() as any;
    const proposal = {
      proposerId: req.user.userId,
      proposedDate: validated.date,
      proposedTime: validated.time || null,
      message: validated.message || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const propRef = await bookingRef.collection('proposals').add(proposal as any);

    // Notify the booking owner (booker)
    try {
      await createNotificationsForUsers([bookingData.userId], {
        title: 'Booking time proposal',
        body: `A new proposed date/time has been suggested for your booking: ${validated.date}${validated.time ? ` at ${validated.time}` : ''}`,
        type: 'booking',
        data: {
          bookingId: id,
          proposalId: propRef.id,
          proposedDate: validated.date,
          ...(validated.time ? { proposedTime: validated.time } : {}),
        },
        createdBy: req.user.userId,
      });
    } catch (notifErr) {
      console.error('Failed to create proposal notification:', notifErr);
    }

    sendSuccess(res, { id: propRef.id, ...proposal }, 'Booking proposal created', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    next(error);
  }
}

// Schema for responding to a proposal
const responseSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

/**
 * POST /api/bookings/:id/proposals/:proposalId/respond
 * Booking owner accepts or rejects a proposal.
 */
export async function respondToProposal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { id, proposalId } = req.params;
    const { action } = responseSchema.parse(req.body);

    const bookingRef = db.collection('bookings').doc(id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Booking not found', null, 404);
      return;
    }

    const bookingData = bookingDoc.data() as any;

    // Only the booking owner (booker) can respond
    if (bookingData.userId !== req.user.userId) {
      sendError(res, 'FORBIDDEN', 'Only the booking owner can respond to proposals', null, 403);
      return;
    }

    const propRef = bookingRef.collection('proposals').doc(proposalId);
    const propDoc = await propRef.get();
    if (!propDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Proposal not found', null, 404);
      return;
    }

    const propData = propDoc.data() as any;
    if (propData.status !== 'pending') {
      sendError(res, 'VALIDATION_ERROR', 'Proposal already responded', null, 400);
      return;
    }

    if (action === 'accept') {
      // Update booking date/time
      await bookingRef.update({
        date: propData.proposedDate,
        time: propData.proposedTime || null,
        updatedAt: new Date(),
      });

      await propRef.update({ status: 'accepted', respondedBy: req.user.userId, respondedAt: new Date(), updatedAt: new Date() });

      // Notify proposer (admin)
      try {
        await createNotificationsForUsers([propData.proposerId], {
          title: 'Proposal accepted',
          body: `The booking owner accepted your proposed date/time for booking ${id}.`,
          type: 'booking',
          data: { bookingId: id, proposalId },
          createdBy: req.user.userId,
        });
      } catch (notifErr) {
        console.error('Failed to notify proposer about acceptance:', notifErr);
      }

      sendSuccess(res, { success: true }, 'Proposal accepted and booking updated');
      return;
    }

    // action === 'reject'
    await propRef.update({ status: 'rejected', respondedBy: req.user.userId, respondedAt: new Date(), updatedAt: new Date() });

    try {
      await createNotificationsForUsers([propData.proposerId], {
        title: 'Proposal declined',
        body: `The booking owner declined your proposed date/time for booking ${id}.`,
        type: 'booking',
        data: { bookingId: id, proposalId },
        createdBy: req.user.userId,
      });
    } catch (notifErr) {
      console.error('Failed to notify proposer about rejection:', notifErr);
    }

    sendSuccess(res, { success: true }, 'Proposal rejected');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    next(error);
  }
}

