import express, { type Express } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import { createApplicationsRouter } from './routes/applications.js';

export function createApp(prisma: PrismaClient): Express {
  const app = express();

  app.use(express.json());
  app.use('/applications', createApplicationsRouter(prisma));

  return app;
}
