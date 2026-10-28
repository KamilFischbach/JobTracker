import { Router } from 'express';
import { z } from 'zod';
import { type JobPage, PageFetchError } from '../ai/fetch-page.js';
import { type LlmClient, LlmUnavailableError } from '../ai/llm.js';
import {
  extractOffer,
  InvalidLlmOutputError,
  NotAJobOfferError,
} from '../ai/parse-offer.js';

export type AiDependencies = {
  llm: LlmClient;
  fetchPage: (url: string) => Promise<JobPage>;
};

const parseOfferRequestSchema = z.object({
  url: z.url({ protocol: /^https?$/, message: 'Enter a valid http(s) link.' }),
  // Fallback for sites that block automatic downloads: the user pastes the text.
  text: z.string().trim().min(100, 'Paste the full offer text.').max(50_000).optional(),
});

export function createAiRouter({ llm, fetchPage }: AiDependencies): Router {
  const router: Router = Router();

  router.post('/parse-offer', async (request, response) => {
    const parsed = parseOfferRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        message: parsed.error.issues[0]?.message ?? 'Invalid input.',
        errors: parsed.error.issues,
      });
    }

    const { url, text } = parsed.data;

    try {
      const page: JobPage = text
        ? { url, title: null, structuredData: null, text }
        : await fetchPage(url);

      return response.json(await extractOffer(llm, page));
    } catch (error) {
      if (error instanceof PageFetchError) {
        return response
          .status(422)
          .json({ code: 'FETCH_FAILED', message: error.message });
      }
      if (error instanceof NotAJobOfferError) {
        return response
          .status(422)
          .json({ code: 'NOT_A_JOB_OFFER', message: error.message });
      }
      if (error instanceof LlmUnavailableError) {
        return response
          .status(503)
          .json({ code: 'AI_UNAVAILABLE', message: error.message });
      }
      if (error instanceof InvalidLlmOutputError) {
        return response
          .status(502)
          .json({ code: 'AI_INVALID_OUTPUT', message: error.message });
      }
      throw error;
    }
  });

  return router;
}
