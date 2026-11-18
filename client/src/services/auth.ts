import type { AuthUser } from '../types/AuthUser';
import { toApiError } from './api-error';
import { isDemoMode } from './applications';

// The GitHub Pages demo has no backend: the visitor is a local demo user.
const DEMO_USER: AuthUser = { id: 'demo', email: null, isDemo: true };

async function send<T = void>(
  method: 'POST' | 'DELETE',
  path: string,
  body: object | undefined,
  fallback: string,
): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw await toApiError(response, fallback);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/**
 * The logged-in user, or null when there is no valid session.
 *
 * @returns {Promise<AuthUser | null>}
 * @throws {ApiError} On server errors other than 401.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (isDemoMode) return DEMO_USER;

  const response = await fetch('/api/auth/me');
  if (response.status === 401) return null;
  if (!response.ok) throw await toApiError(response, 'Could not check your login');
  return response.json();
}

/**
 * Logs in; the server sets the session cookie.
 *
 * @param {{ email: string; password: string }} input
 * @returns {Promise<AuthUser>} The user.
 * @throws {ApiError} `INVALID_CREDENTIALS`, `RATE_LIMITED`, ...
 */
export function login(input: { email: string; password: string }) {
  return send<AuthUser>('POST', 'login', input, 'Could not log in');
}

/**
 * Starts a temporary demo account with sample applications (24 hours).
 *
 * @param {string | undefined} captchaToken  CAPTCHA answer.
 * @returns {Promise<AuthUser>} The demo user.
 * @throws {ApiError} `CAPTCHA_FAILED`, `RATE_LIMITED`, `DEMO_UNAVAILABLE`.
 */
export function startDemo(captchaToken?: string) {
  return send<AuthUser>('POST', 'demo', { captchaToken }, 'Could not start the demo');
}

/** Ends the session (a demo account is deleted). */
export function logout() {
  return send('POST', 'logout', undefined, 'Could not log out');
}

/**
 * Asks for a sign-up confirmation email.
 *
 * @param {{ email: string; password: string; captchaToken?: string }} input
 * @throws {ApiError} Validation, `CAPTCHA_FAILED`, `RATE_LIMITED`, ...
 */
export function signup(input: {
  email: string;
  password: string;
  captchaToken?: string | undefined;
}) {
  return send('POST', 'signup', input, 'Could not sign up');
}

/**
 * Creates the account from the emailed link and logs in.
 *
 * @param {string} token  Token from the link.
 * @returns {Promise<AuthUser>} The new user.
 * @throws {ApiError} `INVALID_LINK` when the link is used or expired.
 */
export function confirmSignup(token: string) {
  return send<AuthUser>('POST', 'confirm-signup', { token }, 'Could not confirm the account');
}

/**
 * Asks for a password reset email.
 *
 * @param {{ email: string; captchaToken?: string }} input
 */
export function requestPasswordReset(input: {
  email: string;
  captchaToken?: string | undefined;
}) {
  return send('POST', 'forgot-password', input, 'Could not send the email');
}

/**
 * Sets a new password from the emailed link.
 *
 * @param {{ token: string; password: string }} input
 * @throws {ApiError} `INVALID_LINK`, validation errors.
 */
export function resetPassword(input: { token: string; password: string }) {
  return send('POST', 'reset-password', input, 'Could not reset the password');
}

/**
 * Changes the password of the logged-in user.
 *
 * @param {{ currentPassword: string; newPassword: string }} input
 * @throws {ApiError} `WRONG_PASSWORD`, `DEMO_ACCOUNT`, validation errors.
 */
export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return send('POST', 'password', input, 'Could not change the password');
}

/**
 * Deletes the account and all its data.
 *
 * @param {string} password  Confirms the action.
 * @throws {ApiError} `WRONG_PASSWORD`, `DEMO_ACCOUNT`.
 */
export function deleteAccount(password: string) {
  return send('DELETE', 'account', { password }, 'Could not delete the account');
}
