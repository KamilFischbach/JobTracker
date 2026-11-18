import type { PrismaClient } from '../../generated/prisma/client.js';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from '../../schemas/auth.js';
import { buildDemoData } from '../demo/demo-data.js';
import {
  accountExistsEmail,
  noAccountEmail,
  passwordResetEmail,
  signupEmail,
} from './auth-emails.js';
import type { CaptchaVerifier } from './captcha.js';
import { deleteUsers } from './delete-users.js';
import type { EmailSender } from './email-sender.js';
import { hashPassword, verifyPassword } from './password.js';
import type { AuthUser, SessionService } from './session-service.js';
import { hashToken, newToken } from './tokens.js';

const SIGNUP_LINK_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_LINK_TTL_MS = 30 * 60 * 1000;

/** How long a "Try demo" account and its data live. */
export const DEMO_ACCOUNT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Most demo accounts that may exist at once, so a flood of visitors cannot
 * fill the database (each account copies the demo applications).
 */
export const MAX_ACTIVE_DEMO_ACCOUNTS = 1000;

/**
 * Wrong email or password at login. The message does not say which.
 * Answered with 401.
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super(
      'Invalid email or password. If you just signed up, open the link in the confirmation email first.',
    );
  }
}

/**
 * The password typed to confirm a sensitive action is wrong. Answered with
 * 400, not 401, so the client does not treat it as a lost session.
 */
export class WrongPasswordError extends Error {
  constructor() {
    super('The password is not correct.');
  }
}

/**
 * A sign-up or reset link is unknown, used or expired. Answered with 400.
 */
export class InvalidLinkError extends Error {
  constructor(
    message = 'This link is invalid or has expired. Request a new one.',
  ) {
    super(message);
  }
}

/**
 * Temporary demo accounts cannot change credentials or delete themselves
 * (they expire on their own). Answered with 403.
 */
export class DemoAccountError extends Error {
  constructor() {
    super('Demo accounts cannot do this. Create a free account to use it.');
  }
}

/**
 * Too many demo accounts exist right now. Answered with 503.
 */
export class DemoUnavailableError extends Error {
  constructor() {
    super('The demo is very busy right now. Try again later or create a free account.');
  }
}

/**
 * A logged-in user together with the new session for the cookie.
 */
export type LoginResult = {
  user: AuthUser;
  session: { token: string; expiresAt: Date };
};

/**
 * Dependencies of {@link createAuthService}.
 */
export type AuthServiceDependencies = {
  prisma: PrismaClient;
  sessions: SessionService;
  captcha: CaptchaVerifier;
  email: EmailSender;
  /** Public address of the web app, used in email links. */
  appUrl: string;
  now?: () => Date;
};

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function toAuthUser(user: {
  id: string;
  email: string | null;
  isDemo: boolean;
}): AuthUser {
  return { id: user.id, email: user.email, isDemo: user.isDemo };
}

/**
 * Creates the service for sign-up, login and account management.
 *
 * Sign-up and "forgot password" always answer the same way and send an email
 * either way, so they do not reveal which addresses have an account.
 *
 * @param {AuthServiceDependencies} deps  Database, sessions, CAPTCHA, email.
 * @returns {AuthService}                 The service.
 */
export function createAuthService({
  prisma,
  sessions,
  captcha,
  email,
  appUrl,
  now = () => new Date(),
}: AuthServiceDependencies) {
  const link = (path: string, token?: string) =>
    new URL(token ? `${path}#token=${token}` : path, appUrl).toString();
  const expiresIn = (ms: number) => new Date(now().getTime() + ms);

  // Compared against when the user does not exist, so a login for an unknown
  // address takes as long as one with a wrong password.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () =>
    (dummyHash ??= hashPassword('timing-equalizer-not-a-password'));

  async function findValidToken(
    token: string,
    purpose: 'SIGNUP' | 'PASSWORD_RESET',
  ) {
    const record = await prisma.authToken.findUnique({
      where: { id: hashToken(token) },
    });
    if (!record || record.purpose !== purpose || record.expiresAt <= now()) {
      throw new InvalidLinkError();
    }
    return record;
  }

  async function checkPassword(userId: string, password: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      throw new WrongPasswordError();
    }
  }

  return {
    /**
     * Emails a confirmation link; the account is created when it is opened.
     *
     * @param {SignupInput} input  Email, password and CAPTCHA token.
     * @param {string}      ip     Client address, for the CAPTCHA check.
     * @throws {CaptchaFailedError | EmailDeliveryError}
     */
    async signup(input: SignupInput, ip: string | undefined) {
      await captcha.verify(input.captchaToken, ip);
      // Hashed in both branches so the answer time does not tell them apart.
      const passwordHash = await hashPassword(input.password);

      const existing = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        await email.send(
          accountExistsEmail(input.email, link('/login'), link('/forgot-password')),
        );
        return;
      }

      const token = newToken();
      await prisma.authToken.create({
        data: {
          id: hashToken(token),
          purpose: 'SIGNUP',
          email: input.email,
          passwordHash,
          expiresAt: expiresIn(SIGNUP_LINK_TTL_MS),
        },
      });
      await email.send(signupEmail(input.email, link('/confirm-signup', token)));
    },

    /**
     * Creates the account from a sign-up link and logs it in.
     *
     * @param {string} token  Token from the link.
     * @returns {Promise<LoginResult>}
     * @throws {InvalidLinkError} When the link is unknown, expired or already used.
     */
    async confirmSignup(token: string): Promise<LoginResult> {
      const record = await findValidToken(token, 'SIGNUP');
      if (!record.passwordHash) throw new InvalidLinkError();

      let user;
      try {
        [user] = await prisma.$transaction([
          prisma.user.create({
            data: {
              email: record.email,
              passwordHash: record.passwordHash,
              emailVerifiedAt: now(),
            },
          }),
          prisma.authToken.deleteMany({
            where: { purpose: 'SIGNUP', email: record.email },
          }),
        ]);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        throw new InvalidLinkError(
          'This email already has an account. Log in instead.',
        );
      }

      return { user: toAuthUser(user), session: await sessions.create(user.id) };
    },

    /**
     * Checks email and password and starts a session.
     *
     * @param {LoginInput} input          Email and password.
     * @param {string}     previousToken  Session cookie the browser still had; ended.
     * @returns {Promise<LoginResult>}
     * @throws {InvalidCredentialsError}
     */
    async login(input: LoginInput, previousToken?: string): Promise<LoginResult> {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      const valid = user?.passwordHash
        ? await verifyPassword(user.passwordHash, input.password)
        : (await verifyPassword(await getDummyHash(), input.password), false);
      if (!user || !valid) throw new InvalidCredentialsError();

      // A fresh session id on every login prevents session fixation.
      if (previousToken) await sessions.invalidate(previousToken);
      return { user: toAuthUser(user), session: await sessions.create(user.id) };
    },

    /**
     * Creates a temporary demo account with a copy of the demo applications
     * and logs it in. Account, data and session end after 24 hours.
     *
     * @param {string | undefined} captchaToken   CAPTCHA answer.
     * @param {string | undefined} ip             Client address, for the CAPTCHA check.
     * @param {string | undefined} previousToken  Session cookie the browser still had; ended.
     * @returns {Promise<LoginResult>}
     * @throws {CaptchaFailedError | DemoUnavailableError}
     */
    async startDemo(
      captchaToken: string | undefined,
      ip: string | undefined,
      previousToken?: string,
    ): Promise<LoginResult> {
      await captcha.verify(captchaToken, ip);

      const active = await prisma.user.count({
        where: { isDemo: true, expiresAt: { gt: now() } },
      });
      if (active >= MAX_ACTIVE_DEMO_ACCOUNTS) throw new DemoUnavailableError();

      const expiresAt = expiresIn(DEMO_ACCOUNT_TTL_MS);
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { isDemo: true, expiresAt } });
        const { applications, emailEvents } = buildDemoData(created.id);
        await tx.jobApplication.createMany({ data: applications });
        await tx.emailEvent.createMany({ data: emailEvents });
        return created;
      });

      if (previousToken) await sessions.invalidate(previousToken);
      return {
        user: toAuthUser(user),
        session: await sessions.create(user.id, expiresAt),
      };
    },

    /**
     * Ends the session. A demo account is deleted with its data right away,
     * since nobody can log back into it. Unknown tokens are ignored.
     *
     * @param {string} token  Session cookie.
     */
    async logout(token: string) {
      const user = await sessions.validate(token);
      await sessions.invalidate(token);
      if (user?.isDemo) await deleteUsers(prisma, { id: user.id, isDemo: true });
    },

    /**
     * Sets a new password and logs out all other sessions.
     *
     * @param {AuthUser}            user          Logged-in user.
     * @param {ChangePasswordInput} input         Current and new password.
     * @param {string}              currentToken  Session that stays logged in.
     * @throws {DemoAccountError | WrongPasswordError}
     */
    async changePassword(
      user: AuthUser,
      input: ChangePasswordInput,
      currentToken: string,
    ) {
      if (user.isDemo) throw new DemoAccountError();
      await checkPassword(user.id, input.currentPassword);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: await hashPassword(input.newPassword) },
        }),
        prisma.authToken.deleteMany({ where: { userId: user.id } }),
      ]);
      await sessions.invalidateAll(user.id, currentToken);
    },

    /**
     * Deletes the account and everything in it.
     *
     * @param {AuthUser} user      Logged-in user.
     * @param {string}   password  Confirms the action.
     * @throws {DemoAccountError | WrongPasswordError}
     */
    async deleteAccount(user: AuthUser, password: string) {
      if (user.isDemo) throw new DemoAccountError();
      await checkPassword(user.id, password);
      await deleteUsers(prisma, { id: user.id });
    },

    /**
     * Emails a reset link (or, for unknown addresses, a "no account" note).
     *
     * @param {ForgotPasswordInput} input  Email and CAPTCHA token.
     * @param {string}              ip     Client address, for the CAPTCHA check.
     * @throws {CaptchaFailedError | EmailDeliveryError}
     */
    async requestPasswordReset(input: ForgotPasswordInput, ip: string | undefined) {
      await captcha.verify(input.captchaToken, ip);

      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user) {
        await email.send(noAccountEmail(input.email, link('/signup')));
        return;
      }

      const token = newToken();
      await prisma.$transaction([
        // Only the newest link works.
        prisma.authToken.deleteMany({
          where: { purpose: 'PASSWORD_RESET', userId: user.id },
        }),
        prisma.authToken.create({
          data: {
            id: hashToken(token),
            purpose: 'PASSWORD_RESET',
            email: input.email,
            userId: user.id,
            expiresAt: expiresIn(RESET_LINK_TTL_MS),
          },
        }),
      ]);
      await email.send(passwordResetEmail(input.email, link('/reset-password', token)));
    },

    /**
     * Sets a new password from a reset link and logs out every session.
     * The user logs in again with the new password.
     *
     * @param {ResetPasswordInput} input  Token from the link and new password.
     * @throws {InvalidLinkError}
     */
    async resetPassword(input: ResetPasswordInput) {
      const record = await findValidToken(input.token, 'PASSWORD_RESET');
      const { userId } = record;
      if (!userId) throw new InvalidLinkError();

      const passwordHash = await hashPassword(input.password);
      // deleteMany's count makes the link single-use even if it is opened
      // twice at the same moment.
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.authToken.deleteMany({
          where: { id: record.id },
        });
        if (count === 0) throw new InvalidLinkError();
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash },
        });
      });
      await sessions.invalidateAll(userId);
    },
  };
}

/**
 * The service created by {@link createAuthService}.
 */
export type AuthService = ReturnType<typeof createAuthService>;
