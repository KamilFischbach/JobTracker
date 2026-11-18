import { describe, expect, it, vi } from 'vitest';
import {
  CaptchaFailedError,
  createTurnstileVerifier,
} from '../../src/services/auth/captcha.js';
import {
  createResendEmailSender,
  EmailDeliveryError,
} from '../../src/services/auth/email-sender.js';

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Turnstile verifier', () => {
  it('sends the secret, the token and the client address to Cloudflare', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ success: true }));
    await createTurnstileVerifier('secret', fetchFn).verify('token', '203.0.113.7');

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      secret: 'secret',
      response: 'token',
      remoteip: '203.0.113.7',
    });
  });

  it.each([
    ['a rejected token', async () => jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] })],
    ['an HTTP error', async () => jsonResponse({}, 500)],
    ['a network error', async () => { throw new TypeError('fetch failed'); }],
  ])('fails on %s', async (_case, fetchFn) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      createTurnstileVerifier('secret', fetchFn).verify('token', undefined),
    ).rejects.toBeInstanceOf(CaptchaFailedError);
  });

  it('fails without asking Cloudflare when the form has no token', async () => {
    const fetchFn = vi.fn();
    await expect(
      createTurnstileVerifier('secret', fetchFn).verify(undefined, undefined),
    ).rejects.toBeInstanceOf(CaptchaFailedError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('Resend email sender', () => {
  const message = { to: 'user@example.com', subject: 'Hi', text: 'Hello' };

  it('posts the message with the API key', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ id: 'email-id' }));
    await createResendEmailSender({ apiKey: 're_key', from: 'App <a@example.com>', fetchFn }).send(message);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_key' });
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'App <a@example.com>',
      to: ['user@example.com'],
      subject: 'Hi',
      text: 'Hello',
    });
  });

  it('throws EmailDeliveryError when Resend refuses the message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => jsonResponse({ message: 'invalid from' }, 422));
    await expect(
      createResendEmailSender({ apiKey: 'k', from: 'a@example.com', fetchFn }).send(message),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
  });
});
