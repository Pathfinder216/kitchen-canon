# 43 — Fix SSRF in import-from-URL 🔴 SECURITY

**Size:** S-M | **Depends on:** nothing — pure code fix, do immediately

## Problem
`importFromUrl` (`backend/src/services/import.service.ts:147`) fetches any URL an authenticated
user submits and returns the parsed response. A user can point it at `http://192.168.68.x`,
`http://localhost:…`, the router admin page, or cloud-metadata addresses — using the Pi as a
proxy to probe the internal network **with the response content read back to them**. Combined
with open signup (until plan 42), any internet stranger gets this capability by registering.

## Implementation

1. `backend/src/utils/safeFetch.ts` — a hardened fetch for user-supplied URLs:
   - **Scheme**: `new URL(raw)`; allow only `http:`/`https:`; reject others (`file:`, `ftp:`,
     `data:`…) and URLs with embedded credentials (`url.username/password`).
   - **Literal-IP and hostname checks**: reject when the hostname is a literal IP in a blocked
     range, `localhost`, or a single-label/`.local` name.
   - **DNS resolution check**: `dns.promises.lookup(hostname, { all: true })`; reject if ANY
     resolved address falls in a blocked range:
     IPv4 — `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`,
     `169.254.0.0/16` (link-local incl. cloud metadata), `172.16.0.0/12`, `192.168.0.0/16`,
     `198.18.0.0/15`, `224.0.0.0/3` (multicast/reserved);
     IPv6 — `::`, `::1`, `fc00::/7` (ULA), `fe80::/10`, and IPv4-mapped (`::ffff:a.b.c.d` —
     unwrap and run the IPv4 checks).
     Implement the range math in a small pure helper `isPrivateAddress(ip): boolean` —
     exhaustively unit-tested; no dependency needed.
   - **Redirects**: fetch with `redirect: 'manual'`; on 3xx, validate the `Location` target
     through the same checks; follow at most 3 hops; reject cross-scheme downgrades to
     anything but http(s).
   - **Response caps**: keep the existing 10 s timeout; add a 2 MB body cap (read the stream
     and abort past the limit) and require a `text/html`/`application/*+json`/`text/plain`
     content-type — recipe pages are HTML; this isn't a file downloader.
   - Failures throw `AppError(400, 'URL not allowed' | 'URL could not be fetched')` — one
     generic message for all blocked cases (don't oracle which internal hosts exist).
   - **Residual risk note** (document in the file header): DNS rebinding between the lookup
     and the fetch's own resolution is not fully closed without a pinned-IP dispatcher; the
     redirect validation, response caps, and rate limiting (plan 42's `importLimiter`) reduce
     it. Acceptable for this app; revisit with an undici custom-lookup Agent if it ever isn't.
2. Replace the raw `fetch` in `importFromUrl` with `safeFetch`. Audit for any other
   user-controlled outbound fetches (grep `fetch(` in `backend/src`) — `nutrition.service`
   (plan 34, fixed upstream URL) is fine; anything else user-controlled gets `safeFetch`.
3. Tests:
   - `isPrivateAddress` table tests across every listed range ± boundary addresses
     (`9.255.255.255` ok, `10.0.0.0` blocked, `172.15.255.255` ok / `172.16.0.0` blocked,
     `192.167.255.255` ok / `192.168.0.0` blocked, `::ffff:127.0.0.1` blocked…).
   - `safeFetch` unit tests with mocked `dns.lookup` + mocked fetch: scheme rejection,
     credential rejection, private-resolution rejection, redirect-to-private rejection,
     redirect depth cap, size cap abort.
   - Existing import supertest suite stays green (it must already mock/fixture its fetches —
     verify; if it hits real URLs anywhere, fix that while here).

## Acceptance
`POST /api/import/url` with `http://localhost:8080/api/health`, `http://192.168.1.1`,
`http://169.254.169.254/latest/meta-data/`, `file:///etc/passwd`, and a public URL that 302s
to `http://127.0.0.1` all return the generic 400; a normal public recipe URL still imports;
new unit suites green.
