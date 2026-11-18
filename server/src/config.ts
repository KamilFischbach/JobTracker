import { z } from 'zod';

// Empty values in .env (`KEY=`) mean "not set".
const optional = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

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
    OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
    OLLAMA_MODEL: z.string().min(1).default('qwen2.5:7b'),
  })
  .superRefine((env, context) => {
    const require = (ok: boolean, path: string, message: string) => {
      if (!ok) context.addIssue({ code: 'custom', path: [path], message });
    };
    if (env.EMAIL_PROVIDER === 'resend') {
      require(!!env.RESEND_API_KEY, 'RESEND_API_KEY', 'needed for EMAIL_PROVIDER=resend');
      require(!!env.EMAIL_FROM, 'EMAIL_FROM', 'needed for EMAIL_PROVIDER=resend');
    }
    if (env.NODE_ENV === 'production') {
      require(env.APP_URL.startsWith('https://'), 'APP_URL', 'must be https:// in production');
      require(!!env.TURNSTILE_SECRET_KEY, 'TURNSTILE_SECRET_KEY', 'required in production');
      require(env.EMAIL_PROVIDER === 'resend', 'EMAIL_PROVIDER', 'must be "resend" in production');
    }
  });

/**
 * Server settings read from environment variables.
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
