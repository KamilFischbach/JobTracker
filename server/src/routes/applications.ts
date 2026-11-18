import { Router } from 'express';
import {
  createApplicationSchema,
  deleteApplicationsSchema,
  updateApplicationSchema,
} from '../schemas/application.js';
import type { ApplicationService } from '../services/applications/application-service.js';
import { parseInput } from './validation.js';

/**
 * Routes under `/applications`.
 *
 * @param {ApplicationService} applications  Service for the job applications.
 * @returns {Router}                         The router.
 */
export function createApplicationsRouter(
  applications: ApplicationService,
): Router {
  const router: Router = Router();

  router.get('/', async (_request, response) => {
    response.json(await applications.list());
  });

  router.get('/:id', async (request, response) => {
    response.json(await applications.get(request.params.id));
  });

  router.get('/:id/email-events', async (request, response) => {
    response.json(await applications.listEmailEvents(request.params.id));
  });

  router.post('/', async (request, response) => {
    const input = parseInput(createApplicationSchema, request.body);
    response.status(201).json(await applications.create(input));
  });

  router.patch('/:id', async (request, response) => {
    const input = parseInput(updateApplicationSchema, request.body);
    response.json(await applications.update(request.params.id, input));
  });

  router.delete('/:id', async (request, response) => {
    await applications.remove(request.params.id);
    response.status(204).end();
  });

  router.delete('/', async (request, response) => {
    const { ids } = parseInput(deleteApplicationsSchema, request.body);
    response.json({ deletedCount: await applications.removeMany(ids) });
  });

  return router;
}
