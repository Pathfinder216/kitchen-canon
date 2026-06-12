import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Response } from 'express';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';

const BCRYPT_COST = 12;
const SESSION_COOKIE = 'ltc_session';

/**
 * Constant-time check of the submitted signup invite code against SIGNUP_INVITE_CODE. The code is
 * always checked: when SIGNUP_INVITE_CODE is the empty string (the default) only an empty code
 * matches, so signup is effectively open; set it to a secret to gate registration. Both sides are
 * SHA-256 hashed so timingSafeEqual gets equal-length buffers and the comparison neither leaks the
 * code's length nor short-circuits on the first differing byte.
 */
export function isValidInviteCode(provided: string | undefined): boolean {
  const expectedHash = crypto.createHash('sha256').update(config.SIGNUP_INVITE_CODE).digest();
  const providedHash = crypto.createHash('sha256').update(provided ?? '').digest();
  return crypto.timingSafeEqual(expectedHash, providedHash);
}

export interface PublicUser {
  id: string;
  email: string;
}

function toPublicUser(user: { id: string; email: string }): PublicUser {
  return { id: user.id, email: user.email };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Create a new user. Email is expected already lowercased by the Zod schema. */
export async function registerUser(email: string, password: string): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  return toPublicUser(user);
}

/**
 * Verify credentials. Uses an identical error for unknown-email and wrong-password to
 * avoid leaking which emails are registered.
 */
export async function loginUser(email: string, password: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Spend a hash to keep timing roughly constant whether or not the email exists.
    await bcrypt.compare(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
    throw new AppError(401, 'Invalid email or password');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, 'Invalid email or password');
  }
  return toPublicUser(user);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

function sessionExpiry(): Date {
  return new Date(Date.now() + config.SESSION_TTL_HOURS * 3600 * 1000);
}

export async function createSession(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: { userId, expiresAt: sessionExpiry() },
  });
  return session.id;
}

/** Look up a live session, returning its userId. Expired/missing sessions return null. */
export async function getSessionUserId(sessionId: string): Promise<string | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }
  return session.userId;
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

/** Opportunistic cleanup of expired sessions (best-effort, fire-and-forget safe). */
export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}

// ── Cookies ───────────────────────────────────────────────────────────────────

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    signed: true,
    maxAge: config.SESSION_TTL_HOURS * 3600 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    signed: true,
    path: '/',
  });
}

export { SESSION_COOKIE };
