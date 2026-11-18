import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import { errorHandler } from './middleware/error-handler.js';
import { requireAuth } from './middleware/require-auth.js';
import { createAiRouter } from './routes/ai.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { fetchJobPage } from './services/ai/fetch-page.js';
import { createOllamaClient } from './services/ai/llm.js';
import {
  createOfferImportService,
  type OfferImportDependencies,
} from './services/ai/offer-import.js';
import { createApplicationService } from './services/applications/application-service.js';
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
 * Settings for {@link createApp}.
 */
export type AppOptions = {
  /** Database client. */
  prisma: PrismaClient;
  /** Checks login sessions; backed by `prisma` by default. */
  sessions?: SessionService;
  /** LLM client and page fetcher for the AI import; Ollama by default. */
  ai?: OfferImportDependencies;
  /**
   * The n8n email webhook. Off unless `enabled`: its matching searches every
   * user's applications, so it only suits a single-user installation.
   */
  emailWebhook?: { enabled: boolean; apiKey?: string | undefined };
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
  ai = createDefaultAiDependencies(),
  emailWebhook = { enabled: false },
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  const authenticated = requireAuth(sessions);

  app.use(express.json());
  app.use(cookieParser());
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
  app.use(errorHandler);

  return app;
}
