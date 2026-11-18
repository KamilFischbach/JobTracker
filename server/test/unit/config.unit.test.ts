import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const production = {
  NODE_ENV: 'production',
  APP_URL: 'https://jobtracker.example',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_key',
  EMAIL_FROM: 'JobTracker <no-reply@jobtracker.example>',
};

describe('server configuration', () => {
  it('has development defaults', () => {
    expect(loadConfig({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      APP_URL: 'http://localhost:5173',
      TRUST_PROXY: 0,
      EMAIL_PROVIDER: 'console',
      ENABLE_EMAIL_WEBHOOK: false,
    });
  });

  it('accepts a complete production setup', () => {
    expect(loadConfig({ ...production, TRUST_PROXY: '1' })).toMatchObject({
      NODE_ENV: 'production',
      TRUST_PROXY: 1,
    });
  });

  it.each([
    ['TURNSTILE_SECRET_KEY', { TURNSTILE_SECRET_KEY: undefined }],
    ['EMAIL_PROVIDER', { EMAIL_PROVIDER: 'console' }],
    ['APP_URL', { APP_URL: 'http://jobtracker.example' }],
    ['RESEND_API_KEY', { RESEND_API_KEY: '' }],
  ])('refuses to start in production without a valid %s', (name, change) => {
    expect(() => loadConfig({ ...production, ...change })).toThrow(name);
  });

  it('lists every problem at once', () => {
    expect(() => loadConfig({ PORT: 'abc', APP_URL: 'not a url' })).toThrow(
      /PORT[\s\S]*APP_URL/,
    );
  });

  it('turns the webhook on only for "true"', () => {
    expect(loadConfig({ ENABLE_EMAIL_WEBHOOK: 'true' }).ENABLE_EMAIL_WEBHOOK).toBe(true);
    expect(() => loadConfig({ ENABLE_EMAIL_WEBHOOK: 'yes' })).toThrow('ENABLE_EMAIL_WEBHOOK');
  });
});
