import { z } from 'zod';

// Trim + lowercase BEFORE .email() so surrounding whitespace / mixed case validate and store
// in a normalized form.
const emailSchema = z.string().trim().toLowerCase().pipe(z.string().email().max(320));

export const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(200)
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  // Required only when SIGNUP_INVITE_CODE is set; checked in the route (constant-time compare).
  inviteCode: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
