// ---------------------------------------------------------------------------
// safeFetch — a hardened fetch for user-supplied URLs (SSRF defense)
//
// Used by the import-from-URL feature, where an authenticated user hands us an
// arbitrary URL to fetch and parse. Without these guards a user could point us
// at `http://localhost`, the router admin page, RFC1918 hosts, or the cloud
// metadata endpoint (169.254.169.254) and read the response back — using the
// server as a proxy to probe the internal network.
//
// Defenses, in order:
//   - scheme allowlist (http/https only), no embedded credentials
//   - hostname checks (localhost, single-label, *.local)
//   - DNS resolution check: every resolved A/AAAA must be a public address
//   - manual redirect following (max 3 hops), each target re-validated
//   - response caps: 10s timeout, 2 MB body, content-type allowlist
//
// RESIDUAL RISK:
//   - DNS rebinding between our `lookup` and fetch's own internal resolution is
//     not fully closed without a pinned-IP dispatcher (e.g. an undici Agent with
//     a custom `lookup`). The redirect re-validation, response caps, and the
//     per-IP rate limiter on /api/import together make this impractical for the
//     threat model of this app.
//   - We block private/reserved ranges, not the host's own public/WAN IP. On a
//     router with hairpin NAT, `http://<WAN-IP>` could still reach a
//     port-forwarded internal service. Inherent to range filtering.
//   - Teredo (2001::/32) embeds a server IPv4 we don't unwrap; exploiting it
//     needs a working Teredo relay path from the host (deprecated protocol).
// Revisit with a pinned-IP dispatcher if either ever stops being acceptable.
// ---------------------------------------------------------------------------

import net from 'node:net';
import { lookup } from 'node:dns/promises';
import { AppError } from '../middleware/errorHandler.js';

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; KitchenCanon/1.0)';

// Two deliberately vague messages, never revealing which internal hosts exist:
//   NOT_ALLOWED — static URL-string rejections (scheme, credentials, literal
//     private IP, blocked hostname); leaks nothing not already in the URL.
//   NOT_FETCHED — every network/DNS outcome (NXDOMAIN, resolves-private,
//     fetch/read failure); identical across all of them so a caller can't use
//     it as a split-horizon DNS oracle.
const NOT_ALLOWED = 'URL not allowed';
const NOT_FETCHED = 'URL could not be fetched';

// Once a host has cleared every SSRF gate (static URL validation, public-DNS
// resolution, a successful connection) and answered with an HTTP status, that
// status reveals nothing about the internal network — so unlike the deliberately
// vague NXDOMAIN/resolves-private cases, we can give the user the real reason and
// a concrete way forward. A 401/403/429 almost always means a bot wall (e.g.
// Cloudflare's "Just a moment" challenge), which no server-side header tweak can
// pass; the only reliable path is to fetch it in a real browser and hand us the
// page as a file.
function remoteErrorMessage(status: number): string {
  const blocked = status === 401 || status === 403 || status === 429;
  const reason = blocked
    ? `The site blocked this request (HTTP ${status}) — many recipe sites reject automated imports.`
    : `The site returned an error (HTTP ${status}) and could not be imported.`;
  return (
    `${reason} Open the recipe in your browser, then save the page as a PDF ` +
    `(Print → Save as PDF) or copy its text into a .txt file, and use ` +
    `“Import from File” instead.`
  );
}

// ---------------------------------------------------------------------------
// Address-range math (pure, exhaustively unit-tested)
// ---------------------------------------------------------------------------

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = result * 256 + n;
  }
  return result >>> 0;
}

function inCidr4(ipInt: number, base: string, prefix: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// IPv4 ranges that must never be reachable via a user-supplied URL.
const BLOCKED_V4: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8], // "this host" / unspecified
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (incl. cloud metadata 169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 3], // multicast + reserved (224.0.0.0–255.255.255.255)
];

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → fail closed
  return BLOCKED_V4.some(([base, prefix]) => inCidr4(n, base, prefix));
}

/** Expand a (net.isIP-validated) IPv6 string to its 16 bytes, or null. */
function parseIPv6ToBytes(ip: string): number[] | null {
  let addr = ip.split('%')[0]; // strip zone id

  // Convert an embedded trailing IPv4 (::ffff:a.b.c.d / ::a.b.c.d) to hextets.
  if (addr.includes('.')) {
    const idx = addr.lastIndexOf(':');
    const v4 = addr.slice(idx + 1);
    const n = ipv4ToInt(v4);
    if (n === null) return null;
    const hi = ((n >>> 16) & 0xffff).toString(16);
    const lo = (n & 0xffff).toString(16);
    addr = addr.slice(0, idx + 1) + hi + ':' + lo;
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  let hextets: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    hextets = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    hextets = head;
  }
  if (hextets.length !== 8) return null;

  const bytes: number[] = [];
  for (const h of hextets) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(h)) return null;
    const val = parseInt(h, 16);
    bytes.push((val >>> 8) & 0xff, val & 0xff);
  }
  return bytes;
}

function isPrivateIPv6(ip: string): boolean {
  const bytes = parseIPv6ToBytes(ip);
  if (bytes === null) return true; // fail closed

  const v4OfBytes = (i: number) => `${bytes[i]}.${bytes[i + 1]}.${bytes[i + 2]}.${bytes[i + 3]}`;

  // IPv4-mapped (::ffff:a.b.c.d) → unwrap and run the IPv4 checks.
  const v4Mapped =
    bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (v4Mapped) return isPrivateIPv4(v4OfBytes(12));

  // Anything in ::/96 (unspecified ::, loopback ::1, deprecated IPv4-compatible)
  // is internal/reserved — block it all.
  if (bytes.slice(0, 12).every((b) => b === 0)) return true;

  // NAT64 and 6to4 embed an IPv4 address that the gateway will route to —
  // extract it and run the IPv4 checks so e.g. 64:ff9b::7f00:1 / 2002:7f00:1::
  // can't reach 127.0.0.1.
  // We match the whole 64:ff9b::/32 reserved prefix (covers both the RFC 6052
  // /96 well-known prefix and RFC 8215 local-use /48); the embedded v4 lives in
  // the last 32 bits regardless. Over-matching here only touches 0000::/8
  // reserved space, which holds no routable public address.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) {
    return isPrivateIPv4(v4OfBytes(12));
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isPrivateIPv4(v4OfBytes(2));
  }

  // fc00::/7 (unique local addresses)
  if ((bytes[0] & 0xfe) === 0xfc) return true;
  // fe80::/10 (link-local) and fec0::/10 (deprecated site-local)
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true;

  return false;
}

/**
 * True if `ip` (a literal IPv4 or IPv6 address) falls in a blocked range and
 * must not be reachable via a user-supplied URL. Non-IP input fails closed.
 */
export function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP literal → fail closed
}

// ---------------------------------------------------------------------------
// URL / hostname validation
// ---------------------------------------------------------------------------

function normalizeHost(url: URL): string {
  // URL.hostname keeps brackets around IPv6 literals; strip them and any
  // trailing FQDN dot.
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

/** Parse and statically validate a URL; throws AppError(400) on any violation. */
function assertUrlAllowed(raw: string, base?: URL): URL {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    throw new AppError(400, NOT_ALLOWED);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(400, NOT_ALLOWED);
  }
  if (url.username || url.password) {
    throw new AppError(400, NOT_ALLOWED);
  }

  const host = normalizeHost(url);
  if (net.isIP(host) !== 0) {
    if (isPrivateAddress(host)) throw new AppError(400, NOT_ALLOWED);
  } else {
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      throw new AppError(400, NOT_ALLOWED);
    }
    // Single-label names (no dot) resolve via local search domains → internal.
    if (!host.includes('.')) throw new AppError(400, NOT_ALLOWED);
  }
  return url;
}

/** Reject if the hostname resolves to ANY private/blocked address. */
async function assertResolvesPublic(host: string): Promise<void> {
  let results: { address: string }[];
  try {
    results = await lookup(host, { all: true });
  } catch {
    throw new AppError(400, NOT_FETCHED);
  }
  if (results.length === 0) throw new AppError(400, NOT_FETCHED);
  for (const { address } of results) {
    // Use the same "could not be fetched" message as an NXDOMAIN above so a
    // caller can't distinguish "internal host exists (resolves private)" from
    // "host doesn't resolve" — no split-horizon DNS oracle.
    if (isPrivateAddress(address)) throw new AppError(400, NOT_FETCHED);
  }
}

function isAllowedContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase().split(';')[0].trim();
  return (
    ct === 'text/html' ||
    ct === 'text/plain' ||
    ct === 'application/json' ||
    /^application\/.*\+json$/.test(ct)
  );
}

async function readCapped(response: Response, limit: number): Promise<string> {
  try {
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (Buffer.byteLength(text) > limit) throw new AppError(400, NOT_ALLOWED);
      return text;
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > limit) {
          // Swallow a cancel() rejection so it can't mask the cap message below.
          await reader.cancel().catch(() => {});
          throw new AppError(400, NOT_ALLOWED);
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks).toString('utf-8');
  } catch (err) {
    // A body-read timeout (AbortSignal) or mid-stream connection reset arrives
    // here as a raw DOMException — surface it as the generic 400, never a 500.
    if (err instanceof AppError) throw err;
    throw new AppError(400, NOT_FETCHED);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface SafeFetchResult {
  body: string;
  finalUrl: string;
}

/**
 * Fetch a user-supplied URL with SSRF protections. Returns the response body as
 * text. Throws AppError(400) for any blocked or unreachable URL.
 */
export async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
  let current = assertUrlAllowed(rawUrl);

  for (let hop = 0; ; hop++) {
    await assertResolvesPublic(normalizeHost(current));

    let response: Response;
    try {
      response = await fetch(current, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AppError(400, NOT_FETCHED);
    }

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      if (hop >= MAX_REDIRECTS) throw new AppError(400, NOT_FETCHED);
      const location = response.headers.get('location');
      if (!location) throw new AppError(400, NOT_FETCHED);
      // Re-run the full static validation on the redirect target (scheme,
      // credentials, host) — this rejects cross-scheme downgrades too.
      current = assertUrlAllowed(location, current);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new AppError(400, remoteErrorMessage(response.status));
    }

    if (!isAllowedContentType(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      throw new AppError(400, NOT_ALLOWED);
    }

    const body = await readCapped(response, MAX_BODY_BYTES);
    return { body, finalUrl: current.toString() };
  }
}
