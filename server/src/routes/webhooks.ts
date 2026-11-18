import { Router } from 'express';
import { requireApiKey } from '../middleware/require-api-key.js';
import { emailStatusSchema } from '../schemas/email.js';
import type { EmailProcessingService } from '../services/email/email-processing.js';
import { parseInput } from './validation.js';

/**
 * Routes under `/webhooks`, called by the n8n workflow. All of them require
 * the `X-Api-Key` header.
 *
 * @param {EmailProcessingService} emails  Service that applies classified emails.
 * @param {string | undefined}     apiKey  Expected `X-Api-Key`; routes answer 503 without it.
 * @returns {Router}                       The router.
 */
export function createWebhooksRouter(
  emails: EmailProcessingService,
  apiKey: string | undefined,
): Router {
  const router: Router = Router();
  router.use(requireApiKey(apiKey));

  // Called by the n8n workflow after the LLM has classified an email.
  router.post('/email-status', async (request, response) => {
    const email = parseInput(emailStatusSchema, request.body);
    const result = await emails.processEmail(email);
    response.status(result.duplicate ? 200 : 201).json(result);
  });

  return router;
}
