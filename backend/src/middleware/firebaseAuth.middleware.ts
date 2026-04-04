import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { sendError } from '../utils/response.util';

/**
 * Verify Firebase ID token from app (Bearer token).
 * Sets req.firebaseUser = { uid } on success.
 */
export async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'UNAUTHORIZED', 'No token provided', null, 401);
      return;
    }
    const token = authHeader.substring(7);
    const decoded = await auth.verifyIdToken(token);
    (req as any).firebaseUser = { uid: decoded.uid };
    next();
  } catch (error) {
    sendError(res, 'UNAUTHORIZED', 'Invalid or expired token', null, 401);
  }
}
