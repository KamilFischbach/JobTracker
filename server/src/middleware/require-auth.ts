import type { Request, RequestHandler } from 'express';
import type {
  AuthUser,
  SessionService,
} from '../services/auth/session-service.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by {@link requireAuth}; read it with {@link currentUser}. */
      user?: AuthUser;
    }
  }
}

/**
 * Name of the session cookie. The `__Host-` prefix makes browsers accept it
 * only when it is `Secure`, has `Path=/` and no `Domain`, so a subdomain
 * cannot set or overwrite it.
 */
export const SESSION_COOKIE = '__Host-session';

/**
 * The request has no valid session. Answered with 401.
 */
export class UnauthenticatedError extends Error {
  constructor() {
    super('Log in to continue.');
  }
}

/**
 * The session token from the request's cookie, if any.
 *
 * @param {Request} request  Incoming request (after `cookie-parser`).
 * @returns {string | undefined} The token.
 */
export function sessionToken(request: Request): string | undefined {
  const token: unknown = request.cookies?.[SESSION_COOKIE];
  return typeof token === 'string' && token ? token : undefined;
}

/**
 * Lets a request through only with a valid session cookie and stores the
 * user on the request. Needs `cookie-parser` before it.
 *
 * @param {SessionService} sessions  Checks the session token.
 * @returns {RequestHandler}         The middleware.
 * @throws {UnauthenticatedError}    (passed to the error handler) Without a valid session.
 */
export function requireAuth(sessions: SessionService): RequestHandler {
  return async (request, _response, next) => {
    const token = sessionToken(request);
    const user = token ? await sessions.validate(token) : null;
    if (!user) throw new UnauthenticatedError();
    request.user = user;
    next();
  };
}

/**
 * The user stored by {@link requireAuth}.
 *
 * @param {Request} request  Request on a route behind `requireAuth`.
 * @returns {AuthUser}       The logged-in user.
 * @throws {Error}           When the route is not behind `requireAuth` (a bug).
 */
export function currentUser(request: Request): AuthUser {
  if (!request.user) {
    throw new Error('currentUser() used on a route without requireAuth.');
  }
  return request.user;
}
