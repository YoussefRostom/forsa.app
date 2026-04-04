import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { sendSuccess, sendError } from '../utils/response.util';
import { z } from 'zod';

const createProfileSchema = z.object({
  playerName: z.string().optional(),
  age: z.number().optional(),
  position: z.string().optional(),
  academyName: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  fees: z.record(z.string(), z.number()).optional(),
  clinicName: z.string().optional(),
  workingHours: z.any().optional(),
  agentName: z.string().optional(),
  companyName: z.string().optional(),
  parentName: z.string().optional(),
  childrenCount: z.number().optional(),
});

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 */
export async function getUserProfile(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const userId = req.user.userId;
    const role = req.user.role;

    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      sendError(res, 'NOT_FOUND', 'User not found', null, 404);
      return;
    }

    // Get role-specific profile
    let profile = null;
    const profileCollection = `${role}s`;
    const profileDoc = await db.collection(profileCollection).doc(userId).get();
    if (profileDoc.exists) {
      profile = profileDoc.data();
    }

    const userData = userDoc.data();

    sendSuccess(
      res,
      {
        user: {
          id: userId,
          email: userData?.email,
          phone: userData?.phone,
          role: userData?.role,
          status: userData?.status,
          profilePhoto: userData?.profilePhoto,
          createdAt: userData?.createdAt,
          updatedAt: userData?.updatedAt,
        },
        profile,
      },
      'Profile retrieved successfully'
    );
    // Note: _next is not used but kept for signature
  } catch (error) {
    _next(error);
  }
}

/**
 * @swagger
 * /api/users/profile:
 *   post:
 *     summary: Create user profile
 */
export async function createUserProfile(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const validatedData = createProfileSchema.parse(req.body);
    const userId = req.user.userId;
    const role = req.user.role;

    // Check if profile already exists
    const profileCollection = `${role}s`;
    const existingProfile = await db.collection(profileCollection).doc(userId).get();

    if (existingProfile.exists) {
      sendError(res, 'CONFLICT', 'Profile already exists. Use PUT to update.', null, 409);
      return;
    }

    // Create profile
    const profileData = {
      userId,
      role,
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection(profileCollection).doc(userId).set(profileData);

    sendSuccess(
      res,
      {
        ...profileData,
      },
      'Profile created successfully',
      201
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    _next(error);
  }
}

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 */
export async function updateUserProfile(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const validatedData = createProfileSchema.partial().parse(req.body);
    const userId = req.user.userId;
    const role = req.user.role;

    // Check if profile exists
    const profileCollection = `${role}s`;
    const profileDoc = await db.collection(profileCollection).doc(userId).get();

    if (!profileDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Profile not found. Use POST to create.', null, 404);
      return;
    }

    // Update profile
    await db.collection(profileCollection).doc(userId).update({
      ...validatedData,
      updatedAt: new Date(),
    });

    const updatedDoc = await db.collection(profileCollection).doc(userId).get();

    sendSuccess(
      res,
      {
        ...updatedDoc.data(),
      },
      'Profile updated successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    _next(error);
  }
}

