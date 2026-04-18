import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { auth as firebaseAuth } from '../config/firebase';
import { verifyToken } from '../utils/jwt.util';
import { sendError } from '../utils/response.util';
import { AccountStatus, JwtPayload, UserRole } from '../types';

const isProductionLike = process.env.NODE_ENV === 'production';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'UNAUTHORIZED', 'No token provided', null, 401);
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const userDoc = await db.collection('users').doc(decoded.userId).get();
    if (!userDoc.exists) {
      sendError(res, 'UNAUTHORIZED', 'User not found', null, 401);
      return;
    }

    const userData = userDoc.data();
    if (!userData) {
      sendError(res, 'UNAUTHORIZED', 'User not found', null, 401);
      return;
    }

    if (userData.status === AccountStatus.SUSPENDED || userData.status === AccountStatus.BANNED) {
      sendError(res, 'FORBIDDEN', 'Account is suspended or banned', null, 403);
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: typeof userData.email === 'string' ? userData.email : decoded.email,
      role: userData.role as UserRole,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    next();
  } catch {
    sendError(res, 'UNAUTHORIZED', 'Invalid or expired token', null, 401);
    return;
  }
}

export async function authenticateJwtOrFirebase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'UNAUTHORIZED', 'No token provided', null, 401);
      return;
    }

    const token = authHeader.substring(7).trim();
    let decodedUserId: string | null = null;
    let decodedEmail: string | undefined;
    let issuedAt: number | undefined;
    let expiresAt: number | undefined;

    const decodeJwtPayload = (rawToken: string): Record<string, any> | null => {
      try {
        const [, payload] = rawToken.split('.');
        if (!payload) return null;

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    };

    const tokenPayload = decodeJwtPayload(token);
    const looksLikeFirebaseToken = Boolean(
      typeof tokenPayload?.iss === 'string' && tokenPayload.iss.includes('securetoken.google.com')
    );

    let jwtError: unknown = null;
    let firebaseError: unknown = null;

    if (looksLikeFirebaseToken) {
      try {
        const decoded = await firebaseAuth.verifyIdToken(token);
        decodedUserId = decoded.uid;
        decodedEmail = decoded.email;
        issuedAt = typeof decoded.iat === 'number' ? decoded.iat : undefined;
        expiresAt = typeof decoded.exp === 'number' ? decoded.exp : undefined;
      } catch (error) {
        firebaseError = error;
      }

      if (!decodedUserId) {
        try {
          const decoded = verifyToken(token);
          decodedUserId = decoded.userId;
          decodedEmail = decoded.email;
          issuedAt = decoded.iat;
          expiresAt = decoded.exp;
        } catch (error) {
          jwtError = error;
        }
      }
    } else {
      try {
        const decoded = verifyToken(token);
        decodedUserId = decoded.userId;
        decodedEmail = decoded.email;
        issuedAt = decoded.iat;
        expiresAt = decoded.exp;
      } catch (error) {
        jwtError = error;
      }

      if (!decodedUserId) {
        try {
          const decoded = await firebaseAuth.verifyIdToken(token);
          decodedUserId = decoded.uid;
          decodedEmail = decoded.email;
          issuedAt = typeof decoded.iat === 'number' ? decoded.iat : undefined;
          expiresAt = typeof decoded.exp === 'number' ? decoded.exp : undefined;
        } catch (error) {
          firebaseError = error;
        }
      }
    }

    if (!decodedUserId) {
      const jwtErrorMessage = jwtError instanceof Error ? jwtError.message : String(jwtError || '');
      const firebaseErrorMessage = firebaseError instanceof Error ? firebaseError.message : String(firebaseError || '');
      console.error('[auth] Hybrid token verification failed', {
        looksLikeFirebaseToken,
        issuer: tokenPayload?.iss,
        audience: tokenPayload?.aud,
        jwtError: jwtErrorMessage,
        firebaseError: firebaseErrorMessage,
      });

      const detailMessage = [firebaseErrorMessage, jwtErrorMessage].find((value) => value && value.trim().length > 0);
      const message = !isProductionLike && detailMessage
        ? `Invalid or expired token: ${detailMessage}`
        : 'Invalid or expired token';

      sendError(res, 'UNAUTHORIZED', message, null, 401);
      return;
    }

    const userDoc = await db.collection('users').doc(decodedUserId).get();
    if (!userDoc.exists) {
      sendError(res, 'UNAUTHORIZED', 'User not found', null, 401);
      return;
    }

    const userData = userDoc.data();
    if (!userData) {
      sendError(res, 'UNAUTHORIZED', 'User not found', null, 401);
      return;
    }

    if (userData.status === AccountStatus.SUSPENDED || userData.status === AccountStatus.BANNED) {
      sendError(res, 'FORBIDDEN', 'Account is suspended or banned', null, 403);
      return;
    }

    req.user = {
      userId: decodedUserId,
      email: typeof userData.email === 'string' ? userData.email : decodedEmail,
      role: userData.role as UserRole,
      iat: issuedAt,
      exp: expiresAt,
    };
    next();
  } catch {
    sendError(res, 'UNAUTHORIZED', 'Invalid or expired token', null, 401);
    return;
  }
}

export function requireRole(...allowedRoles: (string | string[])[]) {
  const normalizedRoles = allowedRoles.flat();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    if (!normalizedRoles.includes(req.user.role)) {
      sendError(res, 'FORBIDDEN', 'Insufficient permissions', null, 403);
      return;
    }

    next();
  };
}

