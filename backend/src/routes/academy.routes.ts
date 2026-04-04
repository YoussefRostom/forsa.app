import { Router } from 'express';
import {
  createAcademyProgram,
  getAcademyPrograms,
  getAcademyProgramById,
  updateAcademyProgram,
  deleteAcademyProgram,
  getAcademyProgramsByAcademy,
} from '../controllers/academy.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types';

const router = Router();

/**
 * @swagger
 * /api/academy/programs:
 *   post:
 *     summary: Create a new academy program
 *     tags: [Academy Programs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - fee
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [group_training, private_training, specialized_program]
 *               fee:
 *                 type: number
 *               description:
 *                 type: string
 *               coachName:
 *                 type: string
 *               coachBio:
 *                 type: string
 *               coachPhotoUrl:
 *                 type: string
 *               specializations:
 *                 type: array
 *                 items:
 *                   type: string
 *               maxParticipants:
 *                 type: integer
 *                 default: 1
 *               duration:
 *                 type: integer
 *                 default: 60
 *               availability:
 *                 type: object
 *     responses:
 *       201:
 *         description: Program created successfully
 */
router.post('/programs', authenticate, requireRole([UserRole.ACADEMY]), createAcademyProgram);

/**
 * @swagger
 * /api/academy/programs:
 *   get:
 *     summary: Get academy programs for the authenticated academy
 *     tags: [Academy Programs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Programs retrieved successfully
 */
router.get('/programs', authenticate, requireRole([UserRole.ACADEMY]), getAcademyPrograms);

/**
 * @swagger
 * /api/academy/programs/{id}:
 *   get:
 *     summary: Get academy program by ID
 *     tags: [Academy Programs]
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
 *         description: Program retrieved successfully
 */
router.get('/programs/:id', authenticate, getAcademyProgramById);

/**
 * @swagger
 * /api/academy/programs/{id}:
 *   put:
 *     summary: Update academy program
 *     tags: [Academy Programs]
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
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [group_training, private_training, specialized_program]
 *               fee:
 *                 type: number
 *               description:
 *                 type: string
 *               coachName:
 *                 type: string
 *               coachBio:
 *                 type: string
 *               coachPhotoUrl:
 *                 type: string
 *               specializations:
 *                 type: array
 *                 items:
 *                   type: string
 *               maxParticipants:
 *                 type: integer
 *               duration:
 *                 type: integer
 *               availability:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Program updated successfully
 */
router.put('/programs/:id', authenticate, requireRole([UserRole.ACADEMY]), updateAcademyProgram);

/**
 * @swagger
 * /api/academy/programs/{id}:
 *   delete:
 *     summary: Delete academy program
 *     tags: [Academy Programs]
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
 *         description: Program deleted successfully
 */
router.delete('/programs/:id', authenticate, requireRole([UserRole.ACADEMY]), deleteAcademyProgram);

/**
 * @swagger
 * /api/academy/{academyId}/programs:
 *   get:
 *     summary: Get programs for a specific academy (public endpoint)
 *     tags: [Academy Programs]
 *     parameters:
 *       - in: path
 *         name: academyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Programs retrieved successfully
 */
router.get('/:academyId/programs', getAcademyProgramsByAcademy);

export default router;