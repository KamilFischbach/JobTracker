import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { prisma } from './prisma.js';
import { fetchJobPage } from './services/ai/fetch-page.js';
import { createOllamaClient } from './services/ai/llm.js';
import {
  createDisabledCaptcha,
  createTurnstileVerifier,
} from './services/auth/captcha.js';
import { deleteExpired } from './services/auth/cleanup.js';
import {
  createConsoleEmailSender,
  createResendEmailSender,
} from './services/auth/email-sender.js';

const config = loadConfig();

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
    llm: createOllamaClient({
      baseUrl: config.OLLAMA_BASE_URL,
      model: config.OLLAMA_MODEL,
    }),
    fetchPage: fetchJobPage,
  },
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

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
});
