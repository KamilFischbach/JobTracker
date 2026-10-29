import { PrismaPg } from '@prisma/adapter-pg';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { applyMigrations } from './database.js';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;

describe('applications routes (PostgreSQL integration)', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('jobtracker_test')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    const connectionString = container.getConnectionUri();
    await applyMigrations(connectionString);

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    app = createApp(prisma);
  }, 120_000);

  afterEach(async () => {
    await prisma.jobApplication.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('creates an application, applies database defaults, and returns it from GET', async () => {
    const created = await request(app)
      .post('/applications')
      .send({
        companyName: 'Integration Labs',
        jobTitle: 'React Engineer',
        appliedDate: '2026-10-15',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      companyName: 'Integration Labs',
      jobTitle: 'React Engineer',
      status: 'SAVED',
      currency: 'PLN',
      appliedDate: '2026-10-15T00:00:00.000Z',
    });

    const list = await request(app).get('/applications').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it('rejects invalid creates and salary-inverting partial updates', async () => {
    await request(app)
      .post('/applications')
      .send({ companyName: ' ', jobTitle: 'Engineer' })
      .expect(400);

    const invertedRange = await request(app)
      .post('/applications')
      .send({
        companyName: 'Range Test',
        jobTitle: 'Engineer',
        salaryMin: 18000,
        salaryMax: 15000,
      })
      .expect(400);
    expect(invertedRange.body.message).toBe(
      'Maximum salary must be at least the minimum salary.',
    );
    expect(await prisma.jobApplication.count()).toBe(0);

    const created = await prisma.jobApplication.create({
      data: {
        companyName: 'Range Test',
        jobTitle: 'Engineer',
        salaryMin: 15000,
        salaryMax: 18000,
      },
    });

    await request(app)
      .patch(`/applications/${created.id}`)
      .send({ salaryMax: 14000 })
      .expect(400);

    const unchanged = await prisma.jobApplication.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(Number(unchanged.salaryMax)).toBe(18000);
  });

  it('updates status and returns 404 for a missing application', async () => {
    const created = await prisma.jobApplication.create({
      data: { companyName: 'Status Test', jobTitle: 'Engineer' },
    });

    const updated = await request(app)
      .patch(`/applications/${created.id}`)
      .send({ status: 'INTERVIEW_SCHEDULED' })
      .expect(200);
    expect(updated.body.status).toBe('INTERVIEW_SCHEDULED');

    await request(app).get('/applications/does-not-exist').expect(404);
  });

  it('deletes one application and a batch through their route contracts', async () => {
    const first = await prisma.jobApplication.create({
      data: { companyName: 'Delete One', jobTitle: 'Engineer' },
    });
    const second = await prisma.jobApplication.create({
      data: { companyName: 'Delete Two', jobTitle: 'Engineer' },
    });
    const third = await prisma.jobApplication.create({
      data: { companyName: 'Delete Three', jobTitle: 'Engineer' },
    });

    await request(app).delete(`/applications/${first.id}`).expect(204);
    const batch = await request(app)
      .delete('/applications')
      .send({ ids: [second.id, third.id] })
      .expect(200);

    expect(batch.body.deletedCount).toBe(2);
    expect(await prisma.jobApplication.count()).toBe(0);
  });
});
