import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config.js';
import { SESSION_COOKIE } from '../services/auth.service.js';

// Double-submit CSRF protection. The token is delivered in a JS-readable cookie (ltc_csrf) and
// must be echoed back in the x-csrf-token header on state-changing requests. Bound to the
// session id so it can't be reused across sessions. GET/HEAD/OPTIONS are ignored by default.
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => config.SESSION_SECRET,
  getSessionIdentifier: (req) => (req.signedCookies?.[SESSION_COOKIE] as string | undefined) ?? '',
  cookieName: 'ltc_csrf',
  cookieOptions: {
    httpOnly: false, // the SPA needs to read it to echo it back in the header
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

export { doubleCsrfProtection, generateCsrfToken };
