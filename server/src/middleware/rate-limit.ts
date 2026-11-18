import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

/**
 * Too many requests from this client. Answered with 429.
 */
export class RateLimitedError extends Error {
  constructor() {
    super('Too many attempts. Wait a few minutes and try again.');
  }
}

const MINUTE = 60 * 1000;

const skipAll: RequestHandler = (_request, _response, next) => next();

// Keyed by the client address; IPv6 by /56 (the library's default), since
// one household usually gets a whole range of addresses.
function limiter(options: {
  windowMs: number;
  limit: number;
  keyGenerator?: (request: Request) => string;
  skipSuccessfulRequests?: boolean;
}): RequestHandler {
  return rateLimit({
    ...options,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => next(new RateLimitedError()),
  });
}

function loginEmailKey(request: Request) {
  const email: unknown = request.body?.email;
  return typeof email === 'string'
    ? `email:${email.trim().toLowerCase()}`
    : `ip:${ipKeyGenerator(request.ip ?? '')}`;
}

/**
 * Rate limiters for the API. Counts are kept in memory, which suits a single
 * server process. Pass `enabled: false` to get pass-through middleware.
 *
 * @param {boolean} enabled  Whether to limit at all.
 * @returns {object}  Limiters: `api` (every route), `login` (failed logins,
 *   per address and per email), `sendsEmail` (sign-up / forgot password),
 *   `links` (opening email links), `account` (password checks of a
 *   logged-in user) and `ai` (offer imports).
 */
export function createRateLimits(enabled = true) {
  if (!enabled) {
    return {
      api: skipAll,
      login: [skipAll],
      sendsEmail: skipAll,
      links: skipAll,
      account: skipAll,
      ai: skipAll,
    };
  }
  return {
    api: limiter({ windowMs: MINUTE, limit: 300 }),
    // Only failed attempts count, so a user who logs in is never blocked.
    login: [
      limiter({ windowMs: 15 * MINUTE, limit: 20, skipSuccessfulRequests: true }),
      limiter({
        windowMs: 15 * MINUTE,
        limit: 10,
        skipSuccessfulRequests: true,
        keyGenerator: loginEmailKey,
      }),
    ],
    sendsEmail: limiter({ windowMs: 60 * MINUTE, limit: 5 }),
    links: limiter({ windowMs: 15 * MINUTE, limit: 20 }),
    account: limiter({ windowMs: 15 * MINUTE, limit: 10, skipSuccessfulRequests: true }),
    // Each import downloads a page; the daily AI limits are counted separately.
    ai: limiter({ windowMs: MINUTE, limit: 10 }),
  };
}

/**
 * The limiters created by {@link createRateLimits}.
 */
export type RateLimits = ReturnType<typeof createRateLimits>;
