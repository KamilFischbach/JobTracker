/** Turnstile site key (public); unset in local development. */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

/**
 * Whether forms must wait for a CAPTCHA token. Off when no site key is set
 * (local development); the server then has its check off too.
 */
export const isCaptchaEnabled = Boolean(TURNSTILE_SITE_KEY);
