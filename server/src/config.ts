import { z } from 'zod';
import { emailSchema, newPasswordSchema } from './schemas/auth.js';

// Empty values in .env (`KEY=`) mean "not set".
const optional = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const limit = (fallback: number) => z.coerce.number().int().min(0).default(fallback);

const LLM_DEFAULTS = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:7b', maxInputChars: 24_000 },
  // ~8k characters keeps a request (and its one retry) inside Groq's free
  // per-minute token budget.
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-20b', maxInputChars: 8_000 },
} as const;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_URL: z.url().default('http://localhost:5173'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    TURNSTILE_SECRET_KEY: optional,
    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: optional,
    EMAIL_FROM: optional,
    ENABLE_EMAIL_WEBHOOK: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    WEBHOOK_API_KEY: optional,
    LLM_PROVIDER: z.enum(['ollama', 'groq']).default('ollama'),
    LLM_BASE_URL: optional.pipe(z.url().optional()),
    LLM_MODEL: optional,
    LLM_API_KEY: optional,
    LLM_MAX_INPUT_CHARS: z.coerce.number().int().min(1000).optional(),
    AI_LIMIT_PER_USER: limit(20),
    AI_LIMIT_PER_DEMO_IP: limit(3),
    AI_LIMIT_DEMO_TOTAL: limit(50),
    AI_LIMIT_TOTAL: limit(500),
    IP_HASH_SECRET: optional,
    INITIAL_USER_EMAIL: optional.pipe(emailSchema.optional()),
    INITIAL_USER_PASSWORD: optional.pipe(newPasswordSchema.optional()),
  })
  .superRefine((env, context) => {
    const require = (ok: boolean, path: string, message: string) => {
      if (!ok) context.addIssue({ code: 'custom', path: [path], message });
    };
    if (env.EMAIL_PROVIDER === 'resend') {
      require(!!env.RESEND_API_KEY, 'RESEND_API_KEY', 'needed for EMAIL_PROVIDER=resend');
      require(!!env.EMAIL_FROM, 'EMAIL_FROM', 'needed for EMAIL_PROVIDER=resend');
    }
    if (env.LLM_PROVIDER === 'groq') {
      require(!!env.LLM_API_KEY, 'LLM_API_KEY', 'needed for LLM_PROVIDER=groq');
    }
    if (!!env.INITIAL_USER_EMAIL !== !!env.INITIAL_USER_PASSWORD) {
      const missing = env.INITIAL_USER_EMAIL ? 'INITIAL_USER_PASSWORD' : 'INITIAL_USER_EMAIL';
      require(false, missing, 'set both INITIAL_USER_EMAIL and INITIAL_USER_PASSWORD, or neither');
    }
    if (env.NODE_ENV === 'production') {
      require(
        (env.IP_HASH_SECRET?.length ?? 0) >= 32,
        'IP_HASH_SECRET',
        'required in production, at least 32 characters',
      );
      require(env.APP_URL.startsWith('https://'), 'APP_URL', 'must be https:// in production');
      require(!!env.TURNSTILE_SECRET_KEY, 'TURNSTILE_SECRET_KEY', 'required in production');
      require(env.EMAIL_PROVIDER === 'resend', 'EMAIL_PROVIDER', 'must be "resend" in production');
    }
  })
  .transform((env) => {
    const defaults = LLM_DEFAULTS[env.LLM_PROVIDER];
    return {
      ...env,
      llm: {
        provider: env.LLM_PROVIDER,
        baseUrl: env.LLM_BASE_URL ?? defaults.baseUrl,
        model: env.LLM_MODEL ?? defaults.model,
        apiKey: env.LLM_API_KEY,
        maxInputChars: env.LLM_MAX_INPUT_CHARS ?? defaults.maxInputChars,
      },
      aiLimits: {
        perUser: env.AI_LIMIT_PER_USER,
        perDemoIp: env.AI_LIMIT_PER_DEMO_IP,
        demoTotal: env.AI_LIMIT_DEMO_TOTAL,
        total: env.AI_LIMIT_TOTAL,
      },
      ipHashSecret: env.IP_HASH_SECRET ?? 'development-only',
      initialUser:
        env.INITIAL_USER_EMAIL && env.INITIAL_USER_PASSWORD
          ? { email: env.INITIAL_USER_EMAIL, password: env.INITIAL_USER_PASSWORD }
          : undefined,
    };
  });

/**
 * Server settings read from environment variables, plus the derived `llm`,
 * `aiLimits`, `ipHashSecret` and `initialUser` settings.
 */
export type Config = z.output<typeof envSchema>;

/**
 * Reads and checks the settings, so the server refuses to start with a
 * missing secret instead of failing on the first request.
 *
 * @param {NodeJS.ProcessEnv} env  Usually `process.env`.
 * @returns {Config}               The settings, with defaults applied.
 * @throws {Error}                 Listing every invalid or missing variable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server configuration:\n${problems}`);
  }
  return parsed.data;
}
