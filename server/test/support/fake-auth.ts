import { SESSION_COOKIE } from '../../src/middleware/require-auth.js';
import {
  CaptchaFailedError,
  type CaptchaVerifier,
} from '../../src/services/auth/captcha.js';
import type {
  EmailMessage,
  EmailSender,
} from '../../src/services/auth/email-sender.js';
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
    invalidateAll: async () => {},
  };
}

/**
 * Email sender that keeps messages in memory.
 *
 * @returns {EmailSender & { messages: EmailMessage[]; lastLinkToken(): string }}
 *   The sender, its messages, and the `#token=` of the newest message's link.
 */
export function createOutbox() {
  const messages: EmailMessage[] = [];
  return {
    messages,
    async send(message: EmailMessage) {
      messages.push(message);
    },
    lastLinkToken() {
      const token = messages.at(-1)?.text.match(/#token=([\w-]+)/)?.[1];
      if (!token) throw new Error('The last email has no link token.');
      return token;
    },
  } satisfies EmailSender & Record<string, unknown>;
}

/** CAPTCHA token that {@link fakeCaptcha} rejects; every other one passes. */
export const FAILING_CAPTCHA = 'failing-captcha';

/**
 * CAPTCHA verifier without network: rejects {@link FAILING_CAPTCHA}.
 *
 * @returns {CaptchaVerifier} The fake.
 */
export function fakeCaptcha(): CaptchaVerifier {
  return {
    async verify(token) {
      if (token === FAILING_CAPTCHA) throw new CaptchaFailedError();
    },
  };
}
