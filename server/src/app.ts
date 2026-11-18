import express, { type Express } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import { errorHandler } from './middleware/error-handler.js';
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
 * Builds the Express app: creates the services and mounts their routers.
 * Does not listen on a port, so tests can call it with their own dependencies.
 *
 * @param {PrismaClient}            prisma         Database client.
 * @param {OfferImportDependencies} ai             LLM client and page fetcher for the AI import.
 * @param {string | undefined}      webhookApiKey  Secret n8n must send; webhooks are disabled without it.
 * @returns {Express}                              The configured app.
 */
export function createApp(
  prisma: PrismaClient,
  ai: OfferImportDependencies = createDefaultAiDependencies(),
  webhookApiKey: string | undefined = process.env.WEBHOOK_API_KEY,
): Express {
  const app = express();

  app.use(express.json());
  app.use(
    '/applications',
    createApplicationsRouter(createApplicationService(prisma)),
  );
  app.use('/ai', createAiRouter(createOfferImportService(ai)));
  app.use(
    '/webhooks',
    createWebhooksRouter(createEmailProcessingService(prisma), webhookApiKey),
  );
  app.use(errorHandler);

  return app;
}
