import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { sendSuccess, sendError } from '../utils/response.util';
import { createNotificationForUser } from '../utils/notification.util';
import { BookingStatus, BookingType } from '../types';
import { z } from 'zod';
import { UserRole } from '../types';

// Validation schemas
const createBookingSchema = z.object({
  providerId: z.string().min(1),
  bookingType: z.nativeEnum(BookingType),
  serviceId: z.string().optional(),
  programId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().optional(),
  price: z.number().positive(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
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
    const { providerId, bookingType, serviceId, programId, date, time, price, notes } = validatedData;

    // Check if provider exists
    const providerDoc = await db.collection('users').doc(providerId).get();
    if (!providerDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Provider not found', null, 404);
      return;
    }

    const providerData = providerDoc.data();
    if (providerData?.role !== bookingType) {
      sendError(res, 'VALIDATION_ERROR', `Provider must be of type ${bookingType}`, null, 400);
      return;
    }

    // Check for double booking (same provider, same date/time)
    if (time) {
      const existingBookings = await db
        .collection('bookings')
        .where('providerId', '==', providerId)
        .where('date', '==', date)
        .where('time', '==', time)
        .where('status', 'in', ['requested', 'accepted'])
        .get();

      if (!existingBookings.empty) {
        sendError(res, 'CONFLICT', 'Time slot already booked', null, 409);
        return;
      }
    }

    // Create booking
    const bookingData = {
      userId: req.user.userId,
      providerId,
      bookingType,
      serviceId: serviceId || null,
      programId: programId || null,
      date,
      time: time || null,
      status: BookingStatus.REQUESTED,
      price,
      notes: notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const bookingRef = await db.collection('bookings').add(bookingData);

    // Notify provider about new booking request
    try {
      await createNotificationForUser({
        userId: providerId,
        title: 'New booking request',
        body: `You have received a new booking request for ${date}${time ? ` at ${time}` : ''}.`,
        type: 'booking',
        data: { bookingId: bookingRef.id, status: 'requested' },
        createdBy: req.user!.userId,
      });
    } catch (notifError) {
      console.error('Failed to notify provider about booking:', notifError);
      // Don't fail the booking creation if notification fails
    }

    // Notify booker that request was sent
    try {
      await createNotificationForUser({
        userId: req.user!.userId,
        title: 'Booking request sent',
        body: `Your booking request has been sent and is pending approval.`,
        type: 'booking',
        data: { bookingId: bookingRef.id, status: 'requested' },
        createdBy: req.user!.userId,
      });
    } catch (notifError) {
      console.error('Failed to notify booker:', notifError);
      // Don't fail the booking creation if notification fails
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
    // Check if user owns this booking or is the provider
    if (
      bookingData?.userId !== req.user.userId &&
      bookingData?.providerId !== req.user.userId
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
    if (currentStatus === BookingStatus.CANCELLED || currentStatus === BookingStatus.COMPLETED) {
      sendError(res, 'VALIDATION_ERROR', 'Cannot update cancelled or completed booking', null, 400);
      return;
    }

    // Update booking
    await db.collection('bookings').doc(id).update({
      status: status as BookingStatus,
      updatedAt: new Date(),
    });

    // Notify the booker about status change
    const bookerId = bookingData?.userId as string;
    const statusMessages: Record<string, { title: string; body: string }> = {
      [BookingStatus.ACCEPTED]: { title: 'Booking accepted', body: 'Your booking request has been accepted.' },
      [BookingStatus.REJECTED]: { title: 'Booking rejected', body: 'Your booking request was declined.' },
      [BookingStatus.COMPLETED]: { title: 'Booking completed', body: 'Your booking has been marked as completed.' },
    };
    const msg = statusMessages[status];
    if (bookerId && msg) {
      createNotificationForUser({
        userId: bookerId,
        title: msg.title,
        body: msg.body,
        type: 'booking',
        data: { bookingId: id, status },
        createdBy: req.user!.userId,
      }).catch((err) => console.error('Booking status notification failed:', err));
    }

    const updatedDoc = await db.collection('bookings').doc(id).get();

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

    // User or provider can cancel
    if (
      bookingData?.userId !== req.user.userId &&
      bookingData?.providerId !== req.user.userId
    ) {
      sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
      return;
    }

    // Cannot cancel already cancelled or completed bookings
    if (
      bookingData?.status === BookingStatus.CANCELLED ||
      bookingData?.status === BookingStatus.COMPLETED
    ) {
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
      createNotificationForUser({
        userId: notifyUserId,
        title: 'Booking cancelled',
        body: 'A booking has been cancelled.',
        type: 'booking',
        data: { bookingId: id, status: 'cancelled' },
        createdBy: req.user!.userId,
      }).catch((err) => console.error('Booking cancel notification failed:', err));
    }

    const updatedDoc = await db.collection('bookings').doc(id).get();

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
      await createNotificationForUser({
        userId: bookingData.userId,
        title: 'Booking time proposal',
        body: `A new proposed date/time has been suggested for your booking: ${validated.date}${validated.time ? ` at ${validated.time}` : ''}`,
        type: 'booking',
        data: { bookingId: id, proposalId: propRef.id, proposedDate: validated.date, proposedTime: validated.time || null },
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
        await createNotificationForUser({
          userId: propData.proposerId,
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
      await createNotificationForUser({
        userId: propData.proposerId,
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

