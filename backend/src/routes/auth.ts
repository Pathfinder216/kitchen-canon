import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { authLimiter, loginLimiter, registerLimiter } from '../middleware/rateLimits.js';
import {
  registerUser,
  loginUser,
  getUserById,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  cleanupExpiredSessions,
  isValidInviteCode,
  SESSION_COOKIE,
} from '../services/auth.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Umbrella limiter for all auth endpoints (covers /me, /csrf, /logout); login and register add
// their own stricter limiters below.
router.use(authLimiter);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// POST /api/auth/register — public, CSRF-exempt (mounted before the CSRF middleware).
router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, inviteCode } = req.body;
    // Generic 403 on mismatch — don't reveal whether the email or the code was the problem.
    if (!isValidInviteCode(inviteCode)) {
      throw new AppError(403, 'Invalid invite code');
    }
    const user = await registerUser(email, password);
    const sessionId = await createSession(user.id);
    setSessionCookie(res, sessionId);
    res.status(201).json(user);
  }),
);

// POST /api/auth/login — public, CSRF-exempt.
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await loginUser(email, password);
    const sessionId = await createSession(user.id);
    setSessionCookie(res, sessionId);
    // Opportunistic expired-session cleanup (best-effort).
    void cleanupExpiredSessions();
    res.json(user);
  }),
);

// POST /api/auth/logout — clears the session.
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const sessionId = req.signedCookies?.[SESSION_COOKIE] as string | undefined;
    if (sessionId) {
      await destroySession(sessionId);
    }
    clearSessionCookie(res);
    res.status(204).send();
  }),
);

// GET /api/auth/me — current user (requires a live session).
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.userId!);
    if (!user) {
      throw new AppError(401, 'Not authenticated');
    }
    res.json(user);
  }),
);

// GET /api/auth/csrf — issues a CSRF token (and sets the kc_csrf cookie).
router.get(
  '/csrf',
  asyncHandler(async (req, res) => {
    const csrfToken = generateCsrfToken(req, res);
    res.json({ csrfToken });
  }),
);

export default router;
