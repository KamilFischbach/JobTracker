import { Router } from 'express';
import { prisma } from '../prisma.js';

const router: Router = Router();

router.get('/', async (_request, response) => {
  const applications = await prisma.jobApplication.findMany({
    orderBy: { createdAt: 'desc' },
  });

  response.json(applications);
});

export default router;
