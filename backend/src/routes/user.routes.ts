import { Router } from 'express';
import { getUserProfile, createUserProfile, updateUserProfile } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 */
router.get('/profile', authenticate, getUserProfile);

/**
 * @swagger
 * /api/users/profile:
 *   post:
 *     summary: Create user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               playerName:
 *                 type: string
 *               academyName:
 *                 type: string
 *               clinicName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profile created successfully
 */
router.post('/profile', authenticate, createUserProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', authenticate, updateUserProfile);

export default router;

