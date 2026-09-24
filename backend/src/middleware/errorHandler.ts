import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

// Centralized error handler. Must be registered last, after all routes.
export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  console.error(err);

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(env.nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
};
