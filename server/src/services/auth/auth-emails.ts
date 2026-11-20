import type { EmailMessage } from './email-sender.js';

// Plain-text emails: no tracking, render everywhere, hard to make look like
// phishing by accident.

const SIGNATURE = '\n\nJobTracker';
const NOT_YOU =
  'If you did not ask for this, ignore this email. Nothing will change.';

/**
 * Link that creates the account.
 *
 * @param {string} to    New user's address.
 * @param {string} link  Confirmation link.
 * @returns {EmailMessage}
 */
export function signupEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Confirm your JobTracker account',
    text:
      `Open this link to finish creating your JobTracker account:\n\n${link}\n\n` +
      `The link works once and expires in 24 hours.\n\n${NOT_YOU}${SIGNATURE}`,
  };
}

/**
 * Sent instead of {@link signupEmail} when the address already has an
 * account, so the sign-up form does not reveal which addresses are registered.
 *
 * @param {string} to         Registered address.
 * @param {string} loginLink  Link to the login page.
 * @param {string} resetLink  Link to the "forgot password" page.
 * @returns {EmailMessage}
 */
export function accountExistsEmail(
  to: string,
  loginLink: string,
  resetLink: string,
): EmailMessage {
  return {
    to,
    subject: 'You already have a JobTracker account',
    text:
      `Someone tried to sign up for JobTracker with this address, which already has an account.\n\n` +
      `Log in: ${loginLink}\nForgot your password? ${resetLink}\n\n${NOT_YOU}${SIGNATURE}`,
  };
}

/**
 * Link that sets a new password.
 *
 * @param {string} to    Registered address.
 * @param {string} link  Reset link.
 * @returns {EmailMessage}
 */
export function passwordResetEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Reset your JobTracker password',
    text:
      `Open this link to choose a new password:\n\n${link}\n\n` +
      `The link works once and expires in 30 minutes. Setting a new password logs you out everywhere.\n\n` +
      `${NOT_YOU}${SIGNATURE}`,
  };
}

/**
 * Sent instead of {@link passwordResetEmail} when the address has no
 * account, so the form does not reveal which addresses are registered.
 *
 * @param {string} to          Address that was entered.
 * @param {string} signupLink  Link to the sign-up page.
 * @returns {EmailMessage}
 */
export function noAccountEmail(to: string, signupLink: string): EmailMessage {
  return {
    to,
    subject: 'JobTracker password reset',
    text:
      `Someone asked to reset the JobTracker password for this address, but it has no account.\n\n` +
      `Want one? Sign up: ${signupLink}\n\n${NOT_YOU}${SIGNATURE}`,
  };
}
