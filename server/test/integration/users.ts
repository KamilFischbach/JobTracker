import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { SESSION_COOKIE } from '../../src/middleware/require-auth.js';
import { createSessionService } from '../../src/services/auth/session-service.js';

/**
 * Creates a verified user. The password hash is a placeholder: these tests
 * log in through {@link signIn}, not with a password.
 *
 * @param {PrismaClient} prisma  Database client.
 * @param {string}       email   Address of the user.
 */
export function createUser(prisma: PrismaClient, email: string) {
  return prisma.user.create({
    data: { email, passwordHash: 'not-used', emailVerifiedAt: new Date() },
  });
}

/**
 * Starts a real session for the user.
 *
 * @param {PrismaClient} prisma  Database client.
 * @param {string}       userId  User to log in.
 * @returns {Promise<string>}    Value for the request's `Cookie` header.
 */
export async function signIn(prisma: PrismaClient, userId: string) {
  const { token } = await createSessionService(prisma).create(userId);
  return `${SESSION_COOKIE}=${token}`;
}
