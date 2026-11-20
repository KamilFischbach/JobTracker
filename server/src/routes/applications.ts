import { Router } from 'express';
import {
  createApplicationSchema,
  deleteApplicationsSchema,
  updateApplicationSchema,
} from '../schemas/application.js';
import { currentUser } from '../middleware/require-auth.js';
import type { ApplicationService } from '../services/applications/application-service.js';
import { parseInput } from './validation.js';

/**
 * Routes under `/applications`. Must be mounted behind `requireAuth`; each
 * route works on the logged-in user's applications only.
 *
 * @param {ApplicationService} applications  Service for the job applications.
 * @returns {Router}                         The router.
 */
export function createApplicationsRouter(
  applications: ApplicationService,
): Router {
  const router: Router = Router();

  router.get('/', async (request, response) => {
    const userId = currentUser(request).id;
    response.json(await applications.list(userId));
  });

  router.get('/:id', async (request, response) => {
    const userId = currentUser(request).id;
    response.json(await applications.get(userId, request.params.id));
  });

  router.get('/:id/email-events', async (request, response) => {
    const userId = currentUser(request).id;
    response.json(
      await applications.listEmailEvents(userId, request.params.id),
    );
  });

  router.post('/', async (request, response) => {
    const userId = currentUser(request).id;
    const input = parseInput(createApplicationSchema, request.body);
    response.status(201).json(await applications.create(userId, input));
  });

  router.patch('/:id', async (request, response) => {
    const userId = currentUser(request).id;
    const input = parseInput(updateApplicationSchema, request.body);
    response.json(
      await applications.update(userId, request.params.id, input),
    );
  });

  router.delete('/:id', async (request, response) => {
    const userId = currentUser(request).id;
    await applications.remove(userId, request.params.id);
    response.status(204).end();
  });

  router.delete('/', async (request, response) => {
    const userId = currentUser(request).id;
    const { ids } = parseInput(deleteApplicationsSchema, request.body);
    response.json({
      deletedCount: await applications.removeMany(userId, ids),
    });
  });

  return router;
}
