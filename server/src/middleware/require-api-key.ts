import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

// Hashing first gives equal-length buffers, which timingSafeEqual needs.
function sameSecret(a: string, b: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Lets a request through only if its `X-Api-Key` header matches `apiKey`
 * (compared in constant time). Answers 401 otherwise, and 503 when no key is
 * configured, so the protected routes are off by default.
 *
 * @param {string | undefined} apiKey  The expected secret.
 * @returns {RequestHandler}           The middleware.
 */
export function requireApiKey(apiKey: string | undefined): RequestHandler {
  return (request, response, next) => {
    if (!apiKey) {
      return response
        .status(503)
        .json({ message: 'Webhooks are disabled. Set WEBHOOK_API_KEY.' });
    }
    const sent = request.get('x-api-key');
    if (!sent || !sameSecret(sent, apiKey)) {
      return response.status(401).json({ message: 'Invalid API key.' });
    }
    return next();
  };
}
