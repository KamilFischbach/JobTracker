import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { prisma } from './prisma.js';
import { fetchJobPage } from './services/ai/fetch-page.js';
import { createOllamaClient } from './services/ai/llm.js';
import { createOpenAiCompatibleClient } from './services/ai/openai-compatible.js';
import {
  createDisabledCaptcha,
  createTurnstileVerifier,
} from './services/auth/captcha.js';
import { deleteExpired } from './services/auth/cleanup.js';
import {
  createConsoleEmailSender,
  createResendEmailSender,
} from './services/auth/email-sender.js';
import { ensureInitialUser } from './services/auth/initial-user.js';

const config = loadConfig();
const { llm } = config;

if (!config.TURNSTILE_SECRET_KEY) {
  console.warn('TURNSTILE_SECRET_KEY is not set: CAPTCHA checks are off.');
}

const app = createApp({
  prisma,
  auth: {
    appUrl: config.APP_URL,
    captcha: config.TURNSTILE_SECRET_KEY
      ? createTurnstileVerifier(config.TURNSTILE_SECRET_KEY)
      : createDisabledCaptcha(),
    email:
      config.EMAIL_PROVIDER === 'resend' && config.RESEND_API_KEY && config.EMAIL_FROM
        ? createResendEmailSender({
            apiKey: config.RESEND_API_KEY,
            from: config.EMAIL_FROM,
          })
        : createConsoleEmailSender(),
  },
  ai: {
    llm:
      llm.provider === 'groq' && llm.apiKey
        ? createOpenAiCompatibleClient({
            baseUrl: llm.baseUrl,
            apiKey: llm.apiKey,
            model: llm.model,
            // gpt-oss models reason before answering; low keeps it short.
            reasoningEffort: llm.model.includes('gpt-oss') ? 'low' : undefined,
          })
        : createOllamaClient({ baseUrl: llm.baseUrl, model: llm.model }),
    fetchPage: fetchJobPage,
    maxInputChars: llm.maxInputChars,
  },
  aiUsage: { limits: config.aiLimits, ipHashSecret: config.ipHashSecret },
  emailWebhook: {
    enabled: config.ENABLE_EMAIL_WEBHOOK,
    apiKey: config.WEBHOOK_API_KEY,
  },
  trustProxy: config.TRUST_PROXY,
});

// Hourly cleanup of expired sessions, links and demo accounts.
async function cleanUp() {
  try {
    await deleteExpired(prisma);
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}
void cleanUp();
setInterval(cleanUp, 60 * 60 * 1000).unref();

if (config.initialUser) {
  const result = await ensureInitialUser(prisma, config.initialUser);
  console.log(
    result === 'created'
      ? `Created the account ${config.initialUser.email} (INITIAL_USER_EMAIL).`
      : `The account ${config.initialUser.email} already exists; its password was not changed.`,
  );
}

const server = app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
});

// Graceful shutdown (docker stop sends SIGTERM): finish open requests, then
// close the database pool. Forced exit if that takes longer than 10 s.
function shutDown(signal: string) {
  console.log(`${signal} received, shutting down.`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    prisma
      .$disconnect()
      .catch((error: unknown) => console.error('Closing the database failed:', error))
      .finally(() => process.exit(0));
  });
  server.closeIdleConnections();
}
process.once('SIGTERM', () => shutDown('SIGTERM'));
process.once('SIGINT', () => shutDown('SIGINT'));
