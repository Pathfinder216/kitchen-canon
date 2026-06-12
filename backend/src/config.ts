import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().default('file:../data/database.db'),
  MEDIA_STORAGE_PATH: z.string().default('../data/media'),
  // Auth: signing secret for session/CSRF cookies. No default — production must set it.
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().default(720), // 30 days
  // Whether auth cookies require HTTPS. Defaults to true in production (the app is served behind
  // an HTTPS reverse proxy); override to false only for a throwaway plain-HTTP test.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === undefined ? undefined : v === 'true'),
  // Allowed browser origin for credentialed CORS (only needed when frontend is served
  // from a different origin than the API). In dev the Vite proxy keeps requests same-origin.
  CORS_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  // Effective cookie "secure" flag: explicit COOKIE_SECURE wins, else true in production.
  cookieSecure: parsed.data.COOKIE_SECURE ?? parsed.data.NODE_ENV === 'production',
};
