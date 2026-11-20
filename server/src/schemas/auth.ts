import { z } from 'zod';

// Passwords of 12+ characters that show up in breach lists. Shorter common
// passwords are already rejected by the length rule.
const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123456789123',
  '111111111111',
  '000000000000',
  'qwertyuiop12',
  'qwertyuiopas',
  'qwertyuiopasdf',
  'qwerty123456',
  '1q2w3e4r5t6y',
  '1qaz2wsx3edc',
  'password1234',
  'password12345',
  'password123456',
  'passwordpassword',
  'iloveyou1234',
  'abcdefghijkl',
  'abc123456789',
  'abcd12345678',
  'administrator',
  'letmein12345',
  'welcome12345',
  'zaq12wsxcde3',
  'haslo1234567',
  'jobtracker123',
]);

const email = z
  .string('Enter your email address.')
  .trim()
  .toLowerCase()
  .max(254, 'This email address is too long.')
  .pipe(z.email('Enter a valid email address.'));

/**
 * Rules for a new password: 12–128 characters, not a known common password,
 * not one character repeated. No composition rules (NIST SP 800-63B).
 */
export const newPasswordSchema = z
  .string('Enter a password.')
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine(
    (password) => !COMMON_PASSWORDS.has(password.toLowerCase()),
    'This password is too common. Choose another one.',
  )
  .refine(
    (password) => new Set(password).size > 2,
    'This password is too easy to guess. Choose another one.',
  );

// Existing passwords are only checked for presence: rules may have changed
// since they were set, and the error must not hint at what the rules are.
const currentPassword = z
  .string('Enter your password.')
  .min(1, 'Enter your password.')
  .max(1024);

const captchaToken = z.string().max(4096).optional();

const linkToken = z.string('The link is invalid.').min(1).max(200);

/** Body of `POST /auth/signup`. */
export const signupSchema = z.object({
  email,
  password: newPasswordSchema,
  captchaToken,
});

/** Body of `POST /auth/login`. */
export const loginSchema = z.object({ email, password: currentPassword });

/** Body of `POST /auth/confirm-signup`. */
export const confirmSignupSchema = z.object({ token: linkToken });

/** Body of `POST /auth/demo`. */
export const startDemoSchema = z.object({ captchaToken });

/** Body of `POST /auth/forgot-password`. */
export const forgotPasswordSchema = z.object({ email, captchaToken });

/** Body of `POST /auth/reset-password`. */
export const resetPasswordSchema = z.object({
  token: linkToken,
  password: newPasswordSchema,
});

/** Body of `POST /auth/password`. */
export const changePasswordSchema = z.object({
  currentPassword,
  newPassword: newPasswordSchema,
});

/** Body of `DELETE /auth/account`. */
export const deleteAccountSchema = z.object({ password: currentPassword });

/** Validated body of `POST /auth/signup`. */
export type SignupInput = z.output<typeof signupSchema>;
/** Validated body of `POST /auth/login`. */
export type LoginInput = z.output<typeof loginSchema>;
/** Validated body of `POST /auth/forgot-password`. */
export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>;
/** Validated body of `POST /auth/reset-password`. */
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;
/** Validated body of `POST /auth/password`. */
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
