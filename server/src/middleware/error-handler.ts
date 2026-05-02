import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
  timestamp: string;
  path?: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'Internal server error';

  const errorResponse: ErrorResponse = {
    error: isAppError ? err.constructor.name : 'InternalServerError',
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && !isAppError) {
    errorResponse.details = {
      stack: err.stack,
    };
  }

  // Log error
  console.error(`[${new Date().toISOString()}] Error:`, {
    statusCode,
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(404).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
