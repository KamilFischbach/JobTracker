import express, { type Express } from 'express';
import { fetchJobPage } from './ai/fetch-page.js';
import { createOllamaClient } from './ai/llm.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { type AiDependencies, createAiRouter } from './routes/ai.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createWebhooksRouter } from './routes/webhooks.js';

function createDefaultAiDependencies(): AiDependencies {
  return {
    llm: createOllamaClient({
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
    }),
    fetchPage: fetchJobPage,
  };
}

export function createApp(
  prisma: PrismaClient,
  ai: AiDependencies = createDefaultAiDependencies(),
  webhookApiKey: string | undefined = process.env.WEBHOOK_API_KEY,
): Express {
  const app = express();

  app.use(express.json());
  app.use('/applications', createApplicationsRouter(prisma));
  app.use('/ai', createAiRouter(ai));
  app.use('/webhooks', createWebhooksRouter(prisma, webhookApiKey));

  return app;
}
