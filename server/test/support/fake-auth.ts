import { SESSION_COOKIE } from '../../src/middleware/require-auth.js';
import type {
  AuthUser,
  SessionService,
} from '../../src/services/auth/session-service.js';

/** The user that {@link fakeSessions} logs in. */
export const TEST_USER: AuthUser = {
  id: 'test-user',
  email: 'test@example.com',
  isDemo: false,
};

const VALID_TOKEN = 'valid-token';

/** Cookie header of a logged-in request, for apps built with {@link fakeSessions}. */
export const SIGNED_IN_COOKIE = `${SESSION_COOKIE}=${VALID_TOKEN}`;

/**
 * Session service without a database: only {@link SIGNED_IN_COOKIE} is valid.
 *
 * @param {AuthUser} user  User the valid token belongs to.
 * @returns {SessionService} The fake.
 */
export function fakeSessions(user: AuthUser = TEST_USER): SessionService {
  return {
    create: async () => ({ token: VALID_TOKEN, expiresAt: new Date() }),
    validate: async (token) => (token === VALID_TOKEN ? user : null),
    invalidate: async () => {},
  };
}
