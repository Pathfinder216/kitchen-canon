import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors,
    });
    return;
  }

  // http-errors style errors (e.g. the CSRF library's invalid-token error) carry a statusCode.
  const status = (err as { statusCode?: number; status?: number }).statusCode
    ?? (err as { status?: number }).status;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    res.status(status).json({ error: err.message || 'Request failed' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
