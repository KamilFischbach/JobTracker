import { Router } from 'express';
import { parseOfferRequestSchema } from '../schemas/offer.js';
import type { OfferImportService } from '../services/ai/offer-import.js';
import { parseInput } from './validation.js';

/**
 * Routes under `/ai`.
 *
 * @param {OfferImportService} offerImport  Service that reads job offers.
 * @returns {Router}                        The router.
 */
export function createAiRouter(offerImport: OfferImportService): Router {
  const router: Router = Router();

  router.post('/parse-offer', async (request, response) => {
    const input = parseInput(parseOfferRequestSchema, request.body);
    response.json(await offerImport.importOffer(input));
  });

  return router;
}
