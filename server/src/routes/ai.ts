import { type RequestHandler, Router } from 'express';
import { currentUser } from '../middleware/require-auth.js';
import { parseOfferRequestSchema } from '../schemas/offer.js';
import type { OfferImportService } from '../services/ai/offer-import.js';
import { parseInput } from './validation.js';

/**
 * Routes under `/ai`. Must be mounted behind `requireAuth`.
 *
 * @param {OfferImportService} offerImport  Service that reads job offers.
 * @param {RequestHandler}     limiter      Request-rate limit for the import (page downloads).
 * @returns {Router}                        The router.
 */
export function createAiRouter(
  offerImport: OfferImportService,
  limiter: RequestHandler,
): Router {
  const router: Router = Router();

  router.post('/parse-offer', limiter, async (request, response) => {
    const input = parseInput(parseOfferRequestSchema, request.body);
    response.json(
      await offerImport.importOffer(input, currentUser(request), request.ip),
    );
  });

  router.get('/usage', async (request, response) => {
    response.json(await offerImport.getUsage(currentUser(request), request.ip));
  });

  return router;
}
