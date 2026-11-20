import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const production = {
  NODE_ENV: 'production',
  APP_URL: 'https://jobtracker.example',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_key',
  EMAIL_FROM: 'JobTracker <no-reply@jobtracker.example>',
  IP_HASH_SECRET: 'a-long-random-secret-of-at-least-32-chars',
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
    ['IP_HASH_SECRET', { IP_HASH_SECRET: 'too-short' }],
  ])('refuses to start in production without a valid %s', (name, change) => {
    expect(() => loadConfig({ ...production, ...change })).toThrow(name);
  });

  it('treats empty values as not set (Docker Compose passes them)', () => {
    const empty = Object.fromEntries(
      ['PORT', 'TRUST_PROXY', 'EMAIL_PROVIDER', 'LLM_PROVIDER', 'LLM_MAX_INPUT_CHARS',
        'AI_LIMIT_PER_USER', 'AI_LIMIT_TOTAL', 'INITIAL_USER_EMAIL', 'INITIAL_USER_PASSWORD',
      ].map((name) => [name, '']),
    );
    expect(loadConfig(empty)).toMatchObject({
      PORT: 3000,
      TRUST_PROXY: 0,
      EMAIL_PROVIDER: 'console',
      llm: { provider: 'ollama', maxInputChars: 24_000 },
      aiLimits: { perUser: 20, total: 500 },
      initialUser: undefined,
    });
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

describe('LLM settings', () => {
  it('uses local Ollama by default', () => {
    expect(loadConfig({}).llm).toEqual({
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5:7b',
      apiKey: undefined,
      maxInputChars: 24_000,
    });
  });

  it('uses Groq defaults that fit its free token budget', () => {
    expect(loadConfig({ LLM_PROVIDER: 'groq', LLM_API_KEY: 'gsk_x' }).llm).toEqual({
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'openai/gpt-oss-20b',
      apiKey: 'gsk_x',
      maxInputChars: 8_000,
    });
  });

  it('uses OLLAMA_BASE_URL only as the Ollama default', () => {
    const url = 'http://host.docker.internal:11434';
    expect(loadConfig({ OLLAMA_BASE_URL: url }).llm.baseUrl).toBe(url);
    expect(
      loadConfig({ OLLAMA_BASE_URL: url, LLM_PROVIDER: 'groq', LLM_API_KEY: 'gsk_x' }).llm.baseUrl,
    ).toBe('https://api.groq.com/openai/v1');
    expect(
      loadConfig({ OLLAMA_BASE_URL: url, LLM_BASE_URL: 'http://ollama:11434' }).llm.baseUrl,
    ).toBe('http://ollama:11434');
  });

  it('needs an API key for Groq', () => {
    expect(() => loadConfig({ LLM_PROVIDER: 'groq' })).toThrow('LLM_API_KEY');
  });

  it('reads the AI limits', () => {
    expect(
      loadConfig({ AI_LIMIT_PER_USER: '5', AI_LIMIT_PER_DEMO_IP: '1' }).aiLimits,
    ).toEqual({ perUser: 5, perDemoIp: 1, demoTotal: 50, total: 500 });
  });
});

describe('initial account', () => {
  const password = 'a-strong-start-password';

  it('is off by default', () => {
    expect(loadConfig({}).initialUser).toBeUndefined();
  });

  it('reads the email (lower-cased) and password', () => {
    expect(
      loadConfig({ INITIAL_USER_EMAIL: ' Me@Example.com ', INITIAL_USER_PASSWORD: password })
        .initialUser,
    ).toEqual({ email: 'me@example.com', password });
  });

  it.each([
    ['INITIAL_USER_PASSWORD', { INITIAL_USER_EMAIL: 'me@example.com' }],
    ['INITIAL_USER_EMAIL', { INITIAL_USER_PASSWORD: password }],
  ])('needs %s when only the other one is set', (name, env) => {
    expect(() => loadConfig(env)).toThrow(name);
  });

  it('applies the sign-up rules to the email and password', () => {
    expect(() =>
      loadConfig({ INITIAL_USER_EMAIL: 'not-an-email', INITIAL_USER_PASSWORD: password }),
    ).toThrow('INITIAL_USER_EMAIL');
    expect(() =>
      loadConfig({ INITIAL_USER_EMAIL: 'me@example.com', INITIAL_USER_PASSWORD: 'short' }),
    ).toThrow(/INITIAL_USER_PASSWORD: Use at least 12 characters/);
  });
});
