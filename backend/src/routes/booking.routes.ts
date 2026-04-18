import { Router } from 'express';
import {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  checkInBooking,
  cancelBooking,
  getProviderBookings,
  proposeBookingChange,
  respondToProposal,
} from '../controllers/booking.controller';
import { authenticate, authenticateJwtOrFirebase, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types';

const router = Router();

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerId
 *               - bookingType
 *               - date
 *               - price
 *             properties:
 *               providerId:
 *                 type: string
 *               bookingType:
 *                 type: string
 *                 enum: [academy, clinic]
 *               serviceId:
 *                 type: string
 *               programId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *               price:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post('/', authenticateJwtOrFirebase, createBooking);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Get user's bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, accepted, rejected, cancelled, completed]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [academy, clinic]
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 */
router.get('/', authenticate, getBookings);

/**
 * @swagger
 * /api/bookings/provider:
 *   get:
 *     summary: Get provider's bookings (for academies/clinics)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider bookings retrieved successfully
 */
router.get('/provider', authenticate, getProviderBookings);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking retrieved successfully
 */
router.get('/:id', authenticate, getBookingById);

/**
 * @swagger
 * /api/bookings/{id}/check-in:
 *   post:
 *     summary: Complete booking attendance and create backend revenue record
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *               checkInCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking check-in completed successfully
 */
router.post('/:id/check-in', authenticateJwtOrFirebase, checkInBooking);

/**
 * @swagger
 * /api/bookings/{id}/status:
 *   put:
 *     summary: Update booking status (for providers)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected, completed]
 *     responses:
 *       200:
 *         description: Booking status updated successfully
 */
router.put('/:id/status', authenticate, updateBookingStatus);

/**
 * Admin proposes a new date/time for a booking
 */
router.post('/:id/propose', authenticate, requireRole(UserRole.ADMIN), proposeBookingChange);

/**
 * Booking owner responds to a proposal (accept/reject)
 */
router.post('/:id/proposals/:proposalId/respond', authenticate, respondToProposal);

/**
 * @swagger
 * /api/bookings/{id}/cancel:
 *   put:
 *     summary: Cancel booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */
router.put('/:id/cancel', authenticate, cancelBooking);

export default router;

