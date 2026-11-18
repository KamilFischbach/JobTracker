import type { PrismaClient } from '../../generated/prisma/client.js';
import { hashToken, newToken } from './tokens.js';

/**
 * How long a session stays valid after it is created.
 */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The logged-in user, as the routes see it.
 */
export type AuthUser = {
  id: string;
  email: string | null;
  isDemo: boolean;
};

/**
 * Creates the service that issues and checks login sessions.
 *
 * @param {PrismaClient} prisma  Database client.
 * @param {() => Date}   now     Clock, replaceable in tests.
 * @returns {SessionService}     The service.
 */
export function createSessionService(
  prisma: PrismaClient,
  now: () => Date = () => new Date(),
) {
  return {
    /**
     * Starts a session for the user.
     *
     * @param {string} userId  Owner of the session.
     * @returns {Promise<{ token: string; expiresAt: Date }>}
     *   `token` goes into the cookie and is not stored anywhere else.
     */
    async create(userId: string) {
      const token = newToken();
      const expiresAt = new Date(now().getTime() + SESSION_DURATION_MS);
      await prisma.session.create({
        data: { id: hashToken(token), userId, expiresAt },
      });
      return { token, expiresAt };
    },

    /**
     * Finds the user a session token belongs to. Expired sessions, expired
     * demo accounts and unverified accounts get no user; expired sessions
     * are deleted on the way.
     *
     * @param {string} token  Token from the cookie.
     * @returns {Promise<AuthUser | null>}  The user, or null when not logged in.
     */
    async validate(token: string): Promise<AuthUser | null> {
      const id = hashToken(token);
      const session = await prisma.session.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!session) return null;

      const { user } = session;
      const current = now();
      if (session.expiresAt <= current) {
        await prisma.session.deleteMany({ where: { id } });
        return null;
      }
      if (user.expiresAt && user.expiresAt <= current) return null;
      if (!user.isDemo && !user.emailVerifiedAt) return null;

      return { id: user.id, email: user.email, isDemo: user.isDemo };
    },

    /**
     * Ends a session (log out). Unknown tokens are ignored.
     *
     * @param {string} token  Token from the cookie.
     */
    async invalidate(token: string) {
      await prisma.session.deleteMany({ where: { id: hashToken(token) } });
    },

    /**
     * Ends all of a user's sessions, e.g. after a password change.
     *
     * @param {string} userId     Owner of the sessions.
     * @param {string} keepToken  Session to keep (the one making the change).
     */
    async invalidateAll(userId: string, keepToken?: string) {
      await prisma.session.deleteMany({
        where: {
          userId,
          ...(keepToken ? { id: { not: hashToken(keepToken) } } : {}),
        },
      });
    },
  };
}

/**
 * The service created by {@link createSessionService}.
 */
export type SessionService = ReturnType<typeof createSessionService>;
