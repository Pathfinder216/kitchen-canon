import 'express';

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth after validating the session cookie.
      userId?: string;
    }
  }
}

export {};
