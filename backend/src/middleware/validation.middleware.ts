import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { sendError } from '../utils/response.util';

/**
 * Validation middleware factory
 * Creates a middleware that validates request body/query/params against a Zod schema
 */
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(
          res,
          'VALIDATION_ERROR',
          'Invalid input data',
          error.errors,
          400
        );
        return;
      }
      next(error);
    }
  };
}

/**
 * File upload validation middleware
 * Validates file size and type before processing
 */
export function validateFileUpload(
  maxSizeBytes: number,
  allowedMimeTypes: string[]
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = (req as any).file || (req as any).files?.[0];
    
    if (!file) {
      sendError(res, 'BAD_REQUEST', 'No file uploaded', null, 400);
      return;
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / 1024 / 1024).toFixed(0);
      sendError(
        res,
        'FILE_TOO_LARGE',
        `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
        { maxSize: maxSizeBytes, actualSize: file.size },
        400
      );
      return;
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      sendError(
        res,
        'INVALID_FILE_TYPE',
        `File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
        { allowedTypes: allowedMimeTypes, receivedType: file.mimetype },
        400
      );
      return;
    }

    next();
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  id: z.string().min(1, 'ID is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  pagination: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
};

