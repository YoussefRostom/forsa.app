import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

export function errorHandler(
  err: Error | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  const code = typeof err?.code === 'string' ? err.code : 'INTERNAL_ERROR';
  console.error('[backend] unhandled error:', {
    code,
    statusCode,
    message: err?.message || 'Unknown error',
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });

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
    code,
    statusCode >= 500 ? 'Internal server error' : (err.message || 'Request failed'),
    process.env.NODE_ENV === 'development' ? err.stack : undefined,
    statusCode
  );
}

