import { Router, type CookieOptions, type Response } from 'express';
import {
  currentUser,
  requireAuth,
  SESSION_COOKIE,
  sessionToken,
} from '../middleware/require-auth.js';
import type { RateLimits } from '../middleware/rate-limit.js';
import {
  changePasswordSchema,
  confirmSignupSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  startDemoSchema,
} from '../schemas/auth.js';
import type { AuthService, LoginResult } from '../services/auth/auth-service.js';
import type { SessionService } from '../services/auth/session-service.js';
import { parseInput } from './validation.js';

// HttpOnly: not readable by scripts. Secure + `__Host-` name: HTTPS only
// (browsers make an exception for http://localhost). Lax: not sent on
// cross-site POSTs.
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
};

function startSession(response: Response, { user, session }: LoginResult) {
  response.cookie(SESSION_COOKIE, session.token, {
    ...COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
  return user;
}

function endSession(response: Response) {
  response.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
}

const CHECK_INBOX = {
  message: 'Check your inbox. If the address can be used, we sent you a link.',
};

/**
 * Routes under `/auth`: sign-up, login and account management.
 *
 * @param {AuthService}    auth      Account logic.
 * @param {SessionService} sessions  Checks the session cookie on logged-in routes.
 * @param {RateLimits}     limits    Brute-force and spam protection.
 * @returns {Router}                 The router.
 */
export function createAuthRouter(
  auth: AuthService,
  sessions: SessionService,
  limits: RateLimits,
): Router {
  const router: Router = Router();
  const authenticated = requireAuth(sessions);

  router.post('/signup', limits.sendsEmail, async (request, response) => {
    const input = parseInput(signupSchema, request.body);
    await auth.signup(input, request.ip);
    response.status(202).json(CHECK_INBOX);
  });

  router.post('/confirm-signup', limits.links, async (request, response) => {
    const { token } = parseInput(confirmSignupSchema, request.body);
    response.status(201).json(startSession(response, await auth.confirmSignup(token)));
  });

  router.post('/login', ...limits.login, async (request, response) => {
    const input = parseInput(loginSchema, request.body);
    const result = await auth.login(input, sessionToken(request));
    response.json(startSession(response, result));
  });

  router.post('/demo', limits.demo, async (request, response) => {
    const { captchaToken } = parseInput(startDemoSchema, request.body);
    const result = await auth.startDemo(captchaToken, request.ip, sessionToken(request));
    response.status(201).json(startSession(response, result));
  });

  router.post('/logout', async (request, response) => {
    const token = sessionToken(request);
    if (token) await auth.logout(token);
    endSession(response);
    response.status(204).end();
  });

  router.get('/me', authenticated, (request, response) => {
    response.json(currentUser(request));
  });

  router.post(
    '/forgot-password',
    limits.sendsEmail,
    async (request, response) => {
      const input = parseInput(forgotPasswordSchema, request.body);
      await auth.requestPasswordReset(input, request.ip);
      response.status(202).json(CHECK_INBOX);
    },
  );

  router.post('/reset-password', limits.links, async (request, response) => {
    const input = parseInput(resetPasswordSchema, request.body);
    await auth.resetPassword(input);
    endSession(response);
    response.status(204).end();
  });

  router.post(
    '/password',
    authenticated,
    limits.account,
    async (request, response) => {
      const input = parseInput(changePasswordSchema, request.body);
      // requireAuth only lets requests with a session cookie through.
      const token = sessionToken(request) ?? '';
      await auth.changePassword(currentUser(request), input, token);
      response.status(204).end();
    },
  );

  router.delete(
    '/account',
    authenticated,
    limits.account,
    async (request, response) => {
      const { password } = parseInput(deleteAccountSchema, request.body);
      await auth.deleteAccount(currentUser(request), password);
      endSession(response);
      response.status(204).end();
    },
  );

  return router;
}
