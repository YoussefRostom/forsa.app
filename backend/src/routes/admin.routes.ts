import { Router } from 'express';
import {
  listUsers,
  getUserById,
  updateUserStatus,
  listAllBookings,
  getBookingById as getAdminBookingById,
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types';
import { createAdminMessage } from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/users', listUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID (Admin only)
 *     tags: [Admin]
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
 *         description: User retrieved successfully
 */
router.get('/users/:id', getUserById);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     summary: Update user status (Admin only)
 *     tags: [Admin]
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
 *                 enum: [active, pending, suspended, banned]
 *     responses:
 *       200:
 *         description: User status updated successfully
 */
router.put('/users/:id/status', updateUserStatus);

/**
 * @swagger
 * /api/admin/bookings:
 *   get:
 *     summary: List all bookings (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 */
router.get('/bookings', listAllBookings);

/**
 * @swagger
 * /api/admin/bookings/{id}:
 *   get:
 *     summary: Get booking by ID (Admin only)
 *     tags: [Admin]
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
router.get('/bookings/:id', getAdminBookingById);

/**
 * Record that admin sent a message to a user and create a notification
 */
router.post('/users/:id/message', createAdminMessage);

/**
 * Get admin messages sent to a user
 */
router.get('/users/:id/messages', async (req, res, next) => {
  // Delegate to controller
  try {
    const { id } = req.params;
    const { getAdminMessages } = await import('../controllers/admin.controller');
    return getAdminMessages(req, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;

