import { Request, Response, NextFunction } from 'express';
import { db, auth } from '../config/firebase';
import { hashPassword, comparePassword } from '../utils/bcrypt.util';
import { generateToken, generateRefreshToken } from '../utils/jwt.util';
import { sendSuccess, sendError } from '../utils/response.util';
import { UserRole, AccountStatus } from '../types';
import { z } from 'zod';
import { normalizePhoneForTwilio } from '../utils/phone.util';

// Validation schemas
const signupSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
});

const signinSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
});

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = signupSchema.parse(req.body);
    const { email, phone, password, role } = validatedData;

    // Check if user already exists
    let userQuery = db.collection('users');
    if (email) {
      const emailSnapshot = await userQuery.where('email', '==', email).get();
      if (!emailSnapshot.empty) {
        sendError(res, 'CONFLICT', 'Email already exists', null, 409);
        return;
      }
    }

    const phoneSnapshot = await userQuery.where('phone', '==', phone).get();
    if (!phoneSnapshot.empty) {
      sendError(res, 'CONFLICT', 'Phone number already exists', null, 409);
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate email if not provided (for phone-based auth)
    const userEmail = email || `user_${phone.replace(/\D/g, '')}@forsa.app`;

    // Create Firebase Auth user
    let firebaseUser;
    try {
      const normalizedPhone = normalizePhoneForTwilio(phone);
      firebaseUser = await auth.createUser({
        email: userEmail,
        password: password,
        phoneNumber: normalizedPhone,
      });
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/email-already-exists' || firebaseError.code === 'auth/phone-number-already-exists') {
        sendError(res, 'CONFLICT', 'User already exists', null, 409);
        return;
      }
      throw firebaseError;
    }

    // Create user document in Firestore
    const userData = {
      email: userEmail,
      phone,
      passwordHash, // Store hashed password for backend verification
      role,
      status: AccountStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('users').doc(firebaseUser.uid).set(userData);

    // Generate tokens
    const token = generateToken({
      userId: firebaseUser.uid,
      email: userEmail,
      role,
    });

    const refreshToken = generateRefreshToken({
      userId: firebaseUser.uid,
      email: userEmail,
      role,
    });

    sendSuccess(
      res,
      {
        user: {
          id: firebaseUser.uid,
          email: userEmail,
          phone,
          role,
          status: AccountStatus.PENDING,
        },
        token,
        refreshToken,
      },
      'User created successfully',
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

export async function signin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = signinSchema.parse(req.body);
    const { email, phone, password } = validatedData;

    if (!email && !phone) {
      sendError(res, 'VALIDATION_ERROR', 'Email or phone is required', null, 400);
      return;
    }

    // Find user in Firestore
    let userDoc;
    if (email) {
      const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
      if (snapshot.empty) {
        sendError(res, 'UNAUTHORIZED', 'Invalid credentials', null, 401);
        return;
      }
      userDoc = snapshot.docs[0];
    } else if (phone) {
      const snapshot = await db.collection('users').where('phone', '==', phone).limit(1).get();
      if (snapshot.empty) {
        sendError(res, 'UNAUTHORIZED', 'Invalid credentials', null, 401);
        return;
      }
      userDoc = snapshot.docs[0];
    }

    if (!userDoc) {
      sendError(res, 'UNAUTHORIZED', 'Invalid credentials', null, 401);
      return;
    }

    const userData = userDoc.data();
    const userId = userDoc.id;

    // Check if account is suspended
    if (userData.status === AccountStatus.SUSPENDED || userData.status === AccountStatus.BANNED) {
      sendError(res, 'FORBIDDEN', 'Account is suspended or banned', null, 403);
      return;
    }

    // Verify password
    if (!userData.passwordHash) {
      // If password hash is missing, this user cannot login with password
      // This might happen for users created via social login incorrectly or data migration issues
      console.error(`Login failed: Missing passwordHash for user ${userId}`);
      sendError(res, 'UNAUTHORIZED', 'Invalid credentials', null, 401);
      return;
    }

    const isValidPassword = await comparePassword(password, userData.passwordHash);
    if (!isValidPassword) {
      sendError(res, 'UNAUTHORIZED', 'Invalid credentials', null, 401);
      return;
    }

    // Generate tokens
    const token = generateToken({
      userId,
      email: userData.email,
      role: userData.role,
    });

    const refreshToken = generateRefreshToken({
      userId,
      email: userData.email,
      role: userData.role,
    });

    sendSuccess(
      res,
      {
        user: {
          id: userId,
          email: userData.email,
          phone: userData.phone,
          role: userData.role,
          status: userData.status,
        },
        token,
        refreshToken,
      },
      'Login successful'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      sendError(res, 'VALIDATION_ERROR', 'Refresh token is required', null, 400);
      return;
    }

    const { verifyRefreshToken } = await import('../utils/jwt.util');
    const decoded = verifyRefreshToken(refreshToken);

    // Generate new tokens
    const token = generateToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });

    const newRefreshToken = generateRefreshToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });

    sendSuccess(
      res,
      {
        token,
        refreshToken: newRefreshToken,
      },
      'Token refreshed successfully'
    );
  } catch (error: any) {
    sendError(res, 'UNAUTHORIZED', 'Invalid refresh token', null, 401);
  }
}

export async function getMe(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    const userDoc = await db.collection('users').doc(req.user.userId).get();
    if (!userDoc.exists) {
      sendError(res, 'NOT_FOUND', 'User not found', null, 404);
      return;
    }

    const userData = userDoc.data();
    sendSuccess(
      res,
      {
        id: userDoc.id,
        email: userData?.email,
        phone: userData?.phone,
        role: userData?.role,
        status: userData?.status,
        profilePhoto: userData?.profilePhoto,
        createdAt: userData?.createdAt,
        updatedAt: userData?.updatedAt,
      },
      'User retrieved successfully'
    );
  } catch (error) {
    _next(error);
  }
}

