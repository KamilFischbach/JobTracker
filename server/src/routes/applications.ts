import { Router } from 'express';
import { prisma } from '../prisma.js';
import {
  createApplicationSchema,
  deleteApplicationsSchema,
  updateApplicationSchema,
} from '../schemas/application.js';

const router: Router = Router();

type OmitUndefined<T> = {
  [Key in keyof T]: Exclude<T[Key], undefined>;
};

// Helper function to remove undefined from objects verified with zod;
function omitUndefined<T extends object>(value: T): OmitUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as OmitUndefined<T>;
}

router.get('/', async (_request, response) => {
  const applications = await prisma.jobApplication.findMany({
    orderBy: { appliedDate: { sort: 'desc', nulls: 'last' } },
  });

  return response.json(applications);
});

router.get('/:id', async (request, response) => {
  const application = await prisma.jobApplication.findUnique({
    where: { id: request.params.id },
  });

  if (!application) {
    return response.status(404).json({ message: 'Application not found.' });
  }

  return response.json(application);
});

router.post('/', async (request, response) => {
  const parsed = createApplicationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).send('Incorrect input format!');
  }
  const result = await prisma.jobApplication.create({
    data: omitUndefined(parsed.data),
  });

  return response.status(201).json(result);
});

router.patch('/:id', async (request, response) => {
  const parsed = updateApplicationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ errors: parsed.error.issues });
  }

  const existingApplication = await prisma.jobApplication.findUnique({
    where: { id: request.params.id },
  });
  if (!existingApplication) {
    return response.status(404).json({ message: 'Application not found.' });
  }

  const data = omitUndefined(parsed.data);
  const salaryMin =
    data.salaryMin === undefined
      ? existingApplication.salaryMin
      : data.salaryMin;
  const salaryMax =
    data.salaryMax === undefined
      ? existingApplication.salaryMax
      : data.salaryMax;
  if (
    salaryMin !== null &&
    salaryMax !== null &&
    Number(salaryMin) > Number(salaryMax)
  ) {
    return response.status(400).json({
      message: 'Maximum salary must be at least the minimum salary.',
    });
  }

  const application = await prisma.jobApplication.update({
    where: { id: request.params.id },
    data,
  });

  return response.json(application);
});

router.delete('/:id', async (request, response) => {
  const result = await prisma.jobApplication.deleteMany({
    where: { id: request.params.id },
  });

  if (result.count === 0) {
    return response.status(404).json({ message: 'Application not found.' });
  }

  return response.status(204).end();
});

router.delete('/', async (request, response) => {
  const parsed = deleteApplicationsSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ errors: parsed.error.issues });
  }

  const result = await prisma.jobApplication.deleteMany({
    where: { id: { in: parsed.data.ids } },
  });

  return response.json({ deletedCount: result.count });
});

export default router;
