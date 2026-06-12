# 41 — HTTPS via reverse proxy + secure cookies 🔴 SECURITY, DO FIRST

**Size:** M | **Depends on:** nothing | **Unblocks:** secure cookies, plan 17 (wake lock needs a secure context), plan 42 (trust-proxy groundwork)

## Problem
The app is **internet-facing over plain HTTP** (port 8080, `COOKIE_SECURE=false`). Every login
sends the password in cleartext; the session cookie travels in cleartext on every request.
Anyone observing traffic (hostile network, compromised hop, ARP spoofing on shared WiFi) can
capture credentials and hijack sessions. The architecture docs still describe a LAN-only
deployment — that assumption is dead; update them (step 6).

## Target state
TLS terminates at a reverse proxy on the Pi with an automatic Let's Encrypt cert; the app
container is unreachable except through the proxy; `COOKIE_SECURE=true`; HTTP redirects to
HTTPS.

## Repo-side changes (unconditional)

1. **`app.ts`**: add `app.set('trust proxy', 1)` (gated on `NODE_ENV === 'production'`) so
   `req.ip`, `req.secure`, and rate limiting (plan 42) see the client, not the proxy.
2. **`docker-compose.yml`**:
   - Flip the cookie default: `COOKIE_SECURE: ${COOKIE_SECURE:-true}`.
   - Change the app port mapping to loopback-only — `"127.0.0.1:8080:8080"` — so nothing can
     bypass the proxy even before/without the Caddy service (and host-level proxies can still
     reach it).
3. **Caddy service** (the default path — used when port 443 on the Pi is free; see Host
   integration below):
   ```yaml
   caddy:
     image: caddy:2-alpine
     restart: unless-stopped
     ports: ["80:80", "443:443"]
     volumes:
       - ./Caddyfile:/etc/caddy/Caddyfile:ro
       - caddy_data:/data
       - caddy_config:/config
   ```
   `Caddyfile` at repo root:
   ```
   {$APP_DOMAIN}
   reverse_proxy app:8080
   ```
   Add `APP_DOMAIN` to `.env.example` (with a comment: must be a DNS name pointing at the Pi;
   Let's Encrypt needs it) and pass it through compose `environment`/env file to the caddy
   service. With the Caddy path active, the app service needs no published ports at all
   (`expose: ["8080"]` only) — prefer that over the loopback mapping when Caddy is in compose.
4. **deploy-to-pi.sh**: first-deploy `.env` generation gains `COOKIE_SECURE=true` and an
   `APP_DOMAIN=` line with a loud echo telling the operator to fill it in; the final
   "Deployed!" message prints `https://$APP_DOMAIN` when set.
5. **config.ts**: no change needed (`COOKIE_SECURE` already defaults true in production —
   the compose override was the only thing setting it false). Verify and delete any stale
   comments claiming LAN-HTTP is the deployment model.
6. **Docs**: architecture.md — deployment section gains the proxy diagram/Caddyfile, security
   section moves "HTTPS" from *future hardening* to *current*; delete/replace every
   "plain-HTTP LAN" rationale (config table, compose comments, auth section). Same sweep in
   `docker-compose.yml` comments.

## Host integration (decision point — inspect the Pi)

The operator reports an existing **static site already serving HTTPS on 443** on this network.
Determine what owns 443 on the Pi (`sudo ss -tlnp 'sport = :443'`):
- **443 free on the Pi** (static site lives elsewhere): use the compose Caddy service above;
  point a subdomain (e.g. `cook.example.com`) at the Pi; done.
- **443 already owned by a host-level server on the Pi** (Caddy or nginx): do NOT bind a second
  443. Instead keep the app's loopback-only port mapping and add a vhost to the existing
  server. Caddy: `cook.example.com { reverse_proxy 127.0.0.1:8080 }`. nginx: a `server` block
  with `proxy_pass http://127.0.0.1:8080;` + certbot for the subdomain. Document whichever was
  done in architecture.md.

## Verification
- `https://$APP_DOMAIN` loads with a valid cert; `http://` redirects to https.
- `curl http://<pi-ip>:8080/api/health` from another machine **fails** (connection refused).
- Login from a phone off-LAN; check the `ltc_session` cookie has `Secure` in devtools.
- Wake lock (plan 17, if landed) now activates in cook mode.
- CI: no automated coverage (infra) — but `docker compose config` must validate in the docker
  CI job if plan 02 landed.
