# 44 — Enable CSP + run the container as non-root 🟡 SECURITY (defense-in-depth)

**Size:** S-M | **Depends on:** best after 41 (HTTPS) per the reporting review; independent technically

Two small hardening items bundled: both are "one layer deeper" defenses, neither blocks the
others.

## Part A — Content-Security-Policy

`app.ts:26` currently disables CSP entirely (`helmet({ contentSecurityPolicy: false })`).
The SPA is a compiled Vite bundle — no inline scripts — so a meaningful policy is cheap.

1. Enable in **production only** (in dev the frontend is served by Vite on :5173, not Express,
   so a strict CSP on the API process would only ever bite the prod bundle — and dev HMR would
   violate it anyway):
   ```ts
   helmet({
     contentSecurityPolicy: config.NODE_ENV === 'production' ? {
       directives: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'"],   // style attributes (React inline styles, FLIP animation)
         imgSrc: ["'self'", 'blob:', 'data:'],       // blob: for crop previews (plan 26), data: for icons
         mediaSrc: ["'self'", 'blob:'],
         connectSrc: ["'self'"],                     // API + service worker fetches
         workerSrc: ["'self'"],                      // PWA service worker; tesseract worker (plan 32) is same-origin
         objectSrc: ["'none'"],
         baseUri: ["'self'"],
         frameAncestors: ["'self'"],
       },
     } : false,
   })
   ```
2. Verify against the real built app, not assumptions: `npm run build` both halves, run the
   backend with `NODE_ENV=production`, exercise every page with devtools console open and fix
   violations by adjusting directives **narrowly** (never add `unsafe-inline` to scriptSrc; if
   something inline exists, refactor it out). Known things to check: the PWA registration
   script, manifest icons (SVG data handling), Web Audio (no CSP impact), media playback.
3. If plan 32 (OCR) landed with CDN-hosted tesseract assets, either pin them to self-hosted
   (the plan already prefers that) or add the specific host to `script-src`/`worker-src` —
   prefer self-hosted.
4. Supertest: response headers include `Content-Security-Policy` in production mode
   (spin app with NODE_ENV=production in one test) and not in test mode.

## Part B — non-root container

The Dockerfile sets no `USER`, so Node runs as root in the container.

1. Final stage of `Dockerfile`: the `node:20-alpine` base ships a `node` user (uid 1000). After
   the COPYs:
   ```dockerfile
   RUN mkdir -p /app/data && chown -R node:node /app/data /app/backend /app/frontend
   USER node
   ```
   (`/app/data` must exist and be node-owned BEFORE the volume mounts over it — a named volume
   inherits ownership from the image path on first use.)
2. ⚠️ **Existing deployment migration**: the current `data` volume's files are root-owned; after
   deploying this change the app can't write them. Document in the PR and add a one-time step
   to the deploy flow (manual command in the PR/architecture.md):
   `docker compose exec -u root app chown -R node:node /app/data`.
   Don't bake a recursive chown into the entrypoint permanently (slow on big media dirs and
   needs root); a comment in `docker-entrypoint.sh` pointing at the command is enough.
3. Verify the entrypoint still works as `node`: `prisma db push` writes the DB file, seed runs,
   media uploads write to `/app/data/media`, port 8080 binds (unprivileged, fine).
4. CI: the docker job (plan 02) building the image covers regressions; if `docker compose
   config`/build runs in CI, it stays green.

## Acceptance
Prod app runs with a CSP and zero console violations across all pages; `docker compose exec app
whoami` → `node`; uploads + DB writes still work on a migrated volume; architecture.md security
section updated (CSP + non-root move from future to current).
