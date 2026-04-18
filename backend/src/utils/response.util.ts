import { Response } from 'express';
import { ApiResponse } from '../types';

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode?: number): void;
export function sendSuccess<T>(res: Response, message: string, data: T, statusCode?: number): void;
export function sendSuccess<T>(
  res: Response,
  dataOrMessage: T | string,
  messageOrData?: string | T,
  statusCode: number = 200
): void {
  const data = typeof dataOrMessage === 'string' ? (messageOrData as T) : dataOrMessage;
  const message = typeof dataOrMessage === 'string' ? dataOrMessage : (messageOrData as string | undefined);
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  details?: any,
  statusCode: number = 400
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  res.status(statusCode).json(response);
}

