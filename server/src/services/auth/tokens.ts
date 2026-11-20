import { createHash, randomBytes } from 'node:crypto';

/**
 * Creates an unguessable token (256 bits) for a cookie or an email link.
 *
 * @returns {string} URL-safe token.
 */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash under which a token is stored, so the database never holds a usable
 * token. SHA-256 is enough because tokens are random, not passwords.
 *
 * @param {string} token  Token from a cookie or link.
 * @returns {string}      Hex digest.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
