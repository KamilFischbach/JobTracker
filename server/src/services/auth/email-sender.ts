/**
 * The email provider did not accept the message. Answered with 503.
 */
export class EmailDeliveryError extends Error {
  constructor() {
    super('Could not send the email. Try again later.');
  }
}

/**
 * A plain-text email.
 */
export type EmailMessage = { to: string; subject: string; text: string };

/**
 * Sends transactional emails (sign-up confirmation, password reset).
 */
export type EmailSender = {
  /** @throws {EmailDeliveryError} When the message could not be sent. */
  send(message: EmailMessage): Promise<void>;
};

/**
 * Prints emails to the server console instead of sending them, so links can
 * be opened during local development.
 *
 * @returns {EmailSender} The sender.
 */
export function createConsoleEmailSender(): EmailSender {
  return {
    async send({ to, subject, text }) {
      console.log(`\n--- Email to ${to}: ${subject}\n${text}\n---\n`);
    },
  };
}

/**
 * Sends emails through the Resend HTTP API.
 *
 * @param {object}       options
 * @param {string}       options.apiKey   Resend API key.
 * @param {string}       options.from     Sender, e.g. `JobTracker <no-reply@example.com>`.
 * @param {typeof fetch} options.fetchFn  HTTP client, replaceable in tests.
 * @returns {EmailSender}                 The sender.
 */
export function createResendEmailSender({
  apiKey,
  from,
  fetchFn = fetch,
}: {
  apiKey: string;
  from: string;
  fetchFn?: typeof fetch;
}): EmailSender {
  return {
    async send({ to, subject, text }) {
      let ok = false;
      try {
        const response = await fetchFn('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to: [to], subject, text }),
          signal: AbortSignal.timeout(10_000),
        });
        ok = response.ok;
        if (!ok) console.error(`Resend answered HTTP ${response.status}.`);
      } catch (error) {
        console.error('Resend request failed:', error);
      }
      if (!ok) throw new EmailDeliveryError();
    },
  };
}
