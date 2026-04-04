import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

export function errorHandler(
  err: Error | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  // Zod validation errors
  if (err.name === 'ZodError') {
    sendError(
      res,
      'VALIDATION_ERROR',
      'Validation failed',
      err.errors,
      400
    );
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    sendError(res, 'UNAUTHORIZED', 'Invalid or expired token', null, 401);
    return;
  }

  // Default error
  sendError(
    res,
    'INTERNAL_ERROR',
    err.message || 'Internal server error',
    process.env.NODE_ENV === 'development' ? err.stack : undefined,
    500
  );
}

