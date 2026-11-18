import type { PrismaClient } from '../../generated/prisma/client.js';
import { deleteUsers } from './delete-users.js';

/**
 * Deletes expired sessions, expired email links and expired demo accounts
 * (with their data). Expired rows are already ignored when read; this only
 * keeps the tables small.
 *
 * @param {PrismaClient} prisma  Database client.
 * @param {() => Date}   now     Clock, replaceable in tests.
 * @returns {Promise<{ sessions: number; tokens: number; demoUsers: number }>}
 *   How many rows of each kind were deleted.
 */
export async function deleteExpired(
  prisma: PrismaClient,
  now: () => Date = () => new Date(),
) {
  const expired = { lte: now() };
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: expired } });
  const tokens = await prisma.authToken.deleteMany({ where: { expiresAt: expired } });
  const demoUsers = await deleteUsers(prisma, { isDemo: true, expiresAt: expired });
  return { sessions: sessions.count, tokens: tokens.count, demoUsers };
}
