import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { getSessionUserId, clearSessionCookie, SESSION_COOKIE } from '../services/auth.service.js';

/**
 * Validates the signed session cookie and attaches req.userId. Throws 401 if there is no
 * live session. The client never supplies userId directly — it is derived from the session.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.signedCookies?.[SESSION_COOKIE] as string | undefined;
    if (!sessionId) {
      throw new AppError(401, 'Not authenticated');
    }
    const userId = await getSessionUserId(sessionId);
    if (!userId) {
      clearSessionCookie(res);
      throw new AppError(401, 'Not authenticated');
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
