import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { PrismaClient } from './generated/prisma/client.js';
import { errorHandler } from './middleware/error-handler.js';
import { createRateLimits } from './middleware/rate-limit.js';
import { requireAuth } from './middleware/require-auth.js';
import { requireSameOrigin } from './middleware/same-origin.js';
import { createAiRouter } from './routes/ai.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createAuthRouter } from './routes/auth.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { fetchJobPage } from './services/ai/fetch-page.js';
import { createOllamaClient } from './services/ai/llm.js';
import {
  createOfferImportService,
  type OfferImportDependencies,
} from './services/ai/offer-import.js';
import { createApplicationService } from './services/applications/application-service.js';
import { createAuthService } from './services/auth/auth-service.js';
import {
  type CaptchaVerifier,
  createDisabledCaptcha,
} from './services/auth/captcha.js';
import {
  createConsoleEmailSender,
  type EmailSender,
} from './services/auth/email-sender.js';
import {
  createSessionService,
  type SessionService,
} from './services/auth/session-service.js';
import { createEmailProcessingService } from './services/email/email-processing.js';

function createDefaultAiDependencies(): OfferImportDependencies {
  return {
    llm: createOllamaClient({
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
    }),
    fetchPage: fetchJobPage,
  };
}

/**
 * Settings for {@link createApp}. The defaults suit local development and
 * tests; `index.ts` passes the production values from the config.
 */
export type AppOptions = {
  /** Database client. */
  prisma: PrismaClient;
  /** Checks login sessions; backed by `prisma` by default. */
  sessions?: SessionService;
  /** Sign-up and password-reset dependencies. */
  auth?: {
    /** Public address of the web app: allowed `Origin` and base of email links. */
    appUrl: string;
    captcha: CaptchaVerifier;
    email: EmailSender;
  };
  /** LLM client and page fetcher for the AI import; Ollama by default. */
  ai?: OfferImportDependencies;
  /**
   * The n8n email webhook. Off unless `enabled`: its matching searches every
   * user's applications, so it only suits a single-user installation.
   */
  emailWebhook?: { enabled: boolean; apiKey?: string | undefined };
  /** Number of reverse proxies in front of the app (Express `trust proxy`). */
  trustProxy?: number;
  /** Rate limiting; on by default. */
  rateLimits?: boolean;
};

/**
 * Builds the Express app: creates the services and mounts their routers.
 * Does not listen on a port, so tests can call it with their own dependencies.
 *
 * @param {AppOptions} options  Database client and optional dependencies.
 * @returns {Express}           The configured app.
 */
export function createApp({
  prisma,
  sessions = createSessionService(prisma),
  auth = {
    appUrl: 'http://localhost:5173',
    captcha: createDisabledCaptcha(),
    email: createConsoleEmailSender(),
  },
  ai = createDefaultAiDependencies(),
  emailWebhook = { enabled: false },
  trustProxy = 0,
  rateLimits = true,
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  // Behind Caddy, the client address comes from X-Forwarded-For.
  app.set('trust proxy', trustProxy);

  const limits = createRateLimits(rateLimits);
  const authenticated = requireAuth(sessions);

  // The API only returns JSON, so the strictest headers fit.
  app.use(helmet());
  app.use(limits.api);
  // Pasted offers can be 50,000 characters; 200 kB leaves room for UTF-8.
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(requireSameOrigin(auth.appUrl));

  app.use(
    '/auth',
    createAuthRouter(
      createAuthService({ prisma, sessions, ...auth }),
      sessions,
      limits,
    ),
  );
  app.use(
    '/applications',
    authenticated,
    createApplicationsRouter(createApplicationService(prisma)),
  );
  app.use(
    '/ai',
    authenticated,
    createAiRouter(createOfferImportService(ai)),
  );
  if (emailWebhook.enabled) {
    app.use(
      '/webhooks',
      createWebhooksRouter(
        createEmailProcessingService(prisma),
        emailWebhook.apiKey,
      ),
    );
  }
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use(errorHandler);

  return app;
}
