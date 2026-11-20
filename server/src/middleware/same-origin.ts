import type { RequestHandler } from 'express';

/**
 * A state-changing request came from another site. Answered with 403.
 */
export class ForbiddenOriginError extends Error {
  constructor() {
    super('Requests from other sites are not allowed.');
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection on top of the `SameSite=Lax` cookie: rejects POST, PATCH,
 * DELETE, ... that a browser marks as coming from another origin, using
 * `Sec-Fetch-Site` and `Origin`. Requests without these headers (curl, n8n)
 * pass, because they cannot carry a victim's cookies.
 *
 * @param {string} appUrl   Public address of the web app; its origin is allowed.
 * @returns {RequestHandler}  The middleware.
 * @throws {ForbiddenOriginError}  (passed to the error handler) For cross-origin requests.
 */
export function requireSameOrigin(appUrl: string): RequestHandler {
  const allowedOrigin = new URL(appUrl).origin;

  return (request, _response, next) => {
    if (SAFE_METHODS.has(request.method)) return next();

    const fetchSite = request.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      throw new ForbiddenOriginError();
    }
    const origin = request.get('origin');
    if (origin && origin !== allowedOrigin) throw new ForbiddenOriginError();

    next();
  };
}
