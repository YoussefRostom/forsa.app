import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { sendSuccess, sendError } from '../utils/response.util';
import { AcademyProgramType } from '../types';
import { z } from 'zod';

// Validation schemas
const createProgramSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(AcademyProgramType),
  fee: z.number().positive(),
  description: z.string().optional(),
  coachName: z.string().optional(),
  coachBio: z.string().optional(),
  coachPhotoUrl: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  maxParticipants: z.number().int().positive().default(1),
  duration: z.number().int().positive().default(60),
  availability: z.any().optional(),
});

const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(AcademyProgramType).optional(),
  fee: z.number().positive().optional(),
  description: z.string().optional(),
  coachName: z.string().optional(),
  coachBio: z.string().optional(),
  coachPhotoUrl: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  maxParticipants: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(),
  availability: z.any().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Create a new academy program
 */
export async function createAcademyProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const validatedData = createProgramSchema.parse(req.body);

    const programData = {
      academyId: req.user.userId,
      ...validatedData,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const programRef = await db.collection('academy_programs').add(programData);

    sendSuccess(res, 'Program created successfully', {
      id: programRef.id,
      ...programData,
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    next(error);
  }
}

/**
 * Get academy programs for the authenticated academy
 */
export async function getAcademyPrograms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const programsSnapshot = await db
      .collection('academy_programs')
      .where('academyId', '==', req.user.userId)
      .orderBy('createdAt', 'desc')
      .get();

    const programs = programsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    sendSuccess(res, 'Programs retrieved successfully', programs);
  } catch (error) {
    next(error);
  }
}

/**
 * Get academy program by ID
 */
export async function getAcademyProgramById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const programDoc = await db.collection('academy_programs').doc(id).get();

    if (!programDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Program not found', null, 404);
      return;
    }

    const programData = programDoc.data();

    // Check if user has access to this program
    if (req.user && req.user.userId !== programData?.academyId && req.user.role !== 'admin') {
      sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
      return;
    }

    sendSuccess(res, 'Program retrieved successfully', {
      id: programDoc.id,
      ...programData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update academy program
 */
export async function updateAcademyProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { id } = req.params;
    const validatedData = updateProgramSchema.parse(req.body);

    const programRef = db.collection('academy_programs').doc(id);
    const programDoc = await programRef.get();

    if (!programDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Program not found', null, 404);
      return;
    }

    const programData = programDoc.data();
    if (programData?.academyId !== req.user.userId) {
      sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
      return;
    }

    const updateData = {
      ...validatedData,
      updatedAt: new Date(),
    };

    await programRef.update(updateData);

    sendSuccess(res, 'Program updated successfully', {
      id,
      ...programData,
      ...updateData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    next(error);
  }
}

/**
 * Delete academy program
 */
export async function deleteAcademyProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const { id } = req.params;

    const programRef = db.collection('academy_programs').doc(id);
    const programDoc = await programRef.get();

    if (!programDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Program not found', null, 404);
      return;
    }

    const programData = programDoc.data();
    if (programData?.academyId !== req.user.userId) {
      sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
      return;
    }

    // Check if program has active bookings
    const activeBookings = await db
      .collection('bookings')
      .where('programId', '==', id)
      .where('status', 'in', ['requested', 'accepted'])
      .get();

    if (!activeBookings.empty) {
      sendError(res, 'CONFLICT', 'Cannot delete program with active bookings', null, 409);
      return;
    }

    await programRef.delete();

    sendSuccess(res, 'Program deleted successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Get programs for a specific academy (public endpoint)
 */
export async function getAcademyProgramsByAcademy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { academyId } = req.params;

    // Check if academy exists
    const academyDoc = await db.collection('users').doc(academyId).get();
    if (!academyDoc.exists || academyDoc.data()?.role !== 'academy') {
      sendError(res, 'NOT_FOUND', 'Academy not found', null, 404);
      return;
    }

    const programsSnapshot = await db
      .collection('academy_programs')
      .where('academyId', '==', academyId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const programs = programsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    sendSuccess(res, 'Programs retrieved successfully', programs);
  } catch (error) {
    next(error);
  }
}