# 42 — Rate limiting + gated signup 🔴 SECURITY

**Size:** S-M | **Depends on:** 41's `trust proxy` line (add it here if 41 hasn't landed — one line, gated on production)

## Problem
Zero brute-force protection on `/api/auth/login` and `/api/auth/register`, and signup is open
to the internet. Consequences: unlimited credential-stuffing against known accounts, and any
stranger can create accounts — each able to upload 20 MB media files and drive the URL importer
(see plan 43) — consuming the Pi's disk and bandwidth. This is a personal app for a handful of
people, not a public service.

## Implementation

### Rate limiting
1. `npm install express-rate-limit --prefix backend`.
2. `backend/src/middleware/rateLimits.ts` exporting configured limiters
   (`standardHeaders: true`, `legacyHeaders: false`, JSON error body matching the app's error
   shape `{ error: '...' }` — check `errorHandler.ts` for the exact shape):
   - `loginLimiter`: 10 attempts / 15 min per IP.
   - `registerLimiter`: 5 / hour per IP.
   - `importLimiter`: 20 / hour per IP (the URL importer does outbound fetches — plan 43's
     companion; cheap to add here).
   - `authLimiter` (umbrella for the rest of `/api/auth`): 60 / 15 min.
3. Apply in `routes/auth.ts` per-endpoint (login/register get their strict limiters; the
   router-level umbrella covers `/me`, `/csrf`, `/logout`) and `routes/import.ts`
   (`importLimiter` on both `/url` and `/file`).
4. ⚠️ Requires correct client IPs behind the proxy: ensure
   `app.set('trust proxy', 1)` (production-gated) exists in `app.ts` — plan 41 adds it;
   add it here if implementing first. Without it every client shares the proxy's IP and the
   limiter locks everyone out together.
5. **Skip limiters when `NODE_ENV === 'test'`** (pass `skip: () => config.NODE_ENV === 'test'`)
   so the existing supertest suites (which log in repeatedly via `createAuthedApi`) don't trip
   them. Then add dedicated tests that construct an app with limits active (override skip via
   a small factory param, or set a tiny max in the test): 11th rapid login → 429; register
   limit → 429; 429 body matches the app error shape.

### Gated signup
6. New env var `SIGNUP_INVITE_CODE` (optional string, in `config.ts` Zod, `.env.example`,
   `docker-compose.yml` passthrough):
   - Unset → open signup (current behavior; sensible for first-boot/local dev).
   - Set → `POST /api/auth/register` requires `inviteCode` in the body equal to it
     (`crypto.timingSafeEqual` over hashed buffers; generic 403 "invalid invite code" on
     mismatch — don't reveal whether the email was the problem).
7. Schema: `auth.schema.ts` register schema gains optional `inviteCode: z.string().max(100)`.
8. Frontend `SignupPage.tsx`: always render an "Invite code" field marked "(if required)" —
   simplest UX that avoids needing a config-discovery endpoint; passes through to the API.
   Surface the 403 message verbatim.
9. deploy-to-pi.sh: first-deploy `.env` generation adds
   `SIGNUP_INVITE_CODE=$(openssl rand -hex 8)` and echoes it once so the operator can share it.
10. Tests: register with correct/missing/wrong code (set in test env); open mode when unset.

## Docs
architecture.md security section: move "rate limiting on auth endpoints" from *future
hardening* to *current*; document `SIGNUP_INVITE_CODE` in the config table.

## Acceptance
Brute-forcing login returns 429 well before any meaningful attempt count; a stranger without
the invite code cannot create an account on the Pi; existing users unaffected; full backend
suite green.
