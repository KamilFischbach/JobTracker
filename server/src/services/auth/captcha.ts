/**
 * The CAPTCHA was missing, wrong or could not be checked. Answered with 400.
 */
export class CaptchaFailedError extends Error {
  constructor() {
    super('Could not confirm you are human. Complete the check and try again.');
  }
}

/**
 * Checks a CAPTCHA answer from the browser.
 */
export type CaptchaVerifier = {
  /**
   * @param {string} token  Token the widget put into the form.
   * @param {string} ip     Address of the client, as an extra signal.
   * @throws {CaptchaFailedError} When the answer is not accepted.
   */
  verify(token: string | undefined, ip: string | undefined): Promise<void>;
};

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare Turnstile verifier. Tokens are single-use and expire after five
 * minutes, which Cloudflare enforces.
 *
 * @param {string}       secretKey  Turnstile secret key of the site.
 * @param {typeof fetch} fetchFn    HTTP client, replaceable in tests.
 * @returns {CaptchaVerifier}       The verifier.
 */
export function createTurnstileVerifier(
  secretKey: string,
  fetchFn: typeof fetch = fetch,
): CaptchaVerifier {
  return {
    async verify(token, ip) {
      if (!token) throw new CaptchaFailedError();

      const form = new URLSearchParams({ secret: secretKey, response: token });
      if (ip) form.set('remoteip', ip);

      let success = false;
      try {
        const response = await fetchFn(SITEVERIFY_URL, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(10_000),
        });
        const body = (await response.json()) as { success?: unknown };
        success = response.ok && body.success === true;
      } catch (error) {
        console.error('Turnstile verification failed:', error);
      }
      if (!success) throw new CaptchaFailedError();
    },
  };
}

/**
 * Accepts every request. For local development without Turnstile keys and
 * for tests; production config refuses to start with it.
 *
 * @returns {CaptchaVerifier} The verifier.
 */
export function createDisabledCaptcha(): CaptchaVerifier {
  return { verify: async () => {} };
}
