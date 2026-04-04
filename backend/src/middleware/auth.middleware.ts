import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';
import { sendError } from '../utils/response.util';
import { JwtPayload } from '../types';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'UNAUTHORIZED', 'No token provided', null, 401);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      sendError(res, 'UNAUTHORIZED', 'Invalid or expired token', null, 401);
      return;
    }
  } catch (error) {
    sendError(res, 'INTERNAL_ERROR', 'Authentication error', null, 500);
    return;
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', null, 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 'FORBIDDEN', 'Insufficient permissions', null, 403);
      return;
    }

    next();
  };
}

