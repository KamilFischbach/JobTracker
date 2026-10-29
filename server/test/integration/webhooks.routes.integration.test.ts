import { PrismaPg } from '@prisma/adapter-pg';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LlmClient } from '../../src/ai/llm.js';
import { createApp } from '../../src/app.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { applyMigrations } from './database.js';

const API_KEY = 'test-webhook-key';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;

const unusedAi = {
  llm: { generateJson: async () => '' } satisfies LlmClient,
  fetchPage: async () => {
    throw new Error('not used');
  },
};

function email(overrides: Record<string, unknown> = {}) {
  return {
    messageId: 'msg-1',
    from: 'Acorn Labs Careers <jobs@acornlabs.com>',
    subject: 'Interview invitation',
    receivedAt: '2026-10-28T09:15:00.000Z',
    category: 'INTERVIEW_INVITATION',
    companyName: 'Acorn Labs Sp. z o.o.',
    jobTitle: 'Frontend Engineer',
    confidence: 0.92,
    reason: 'The recruiter proposes interview dates.',
    ...overrides,
  };
}

function send(body: object, apiKey = API_KEY) {
  return request(app)
    .post('/webhooks/email-status')
    .set('X-Api-Key', apiKey)
    .send(body);
}

describe('email status webhook (PostgreSQL integration)', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('jobtracker_test')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    const connectionString = container.getConnectionUri();
    await applyMigrations(connectionString);

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    app = createApp(prisma, unusedAi, API_KEY);
  }, 120_000);

  afterEach(async () => {
    await prisma.emailEvent.deleteMany();
    await prisma.jobApplication.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  async function createApplication(data: {
    companyName: string;
    jobTitle: string;
    status?: 'SAVED' | 'APPLIED' | 'INTERVIEW_SCHEDULED' | 'OFFER' | 'REJECTED';
  }) {
    return prisma.jobApplication.create({ data });
  }

  it('rejects requests without the right API key', async () => {
    await request(app).post('/webhooks/email-status').send(email()).expect(401);
    await send(email(), 'wrong-key').expect(401);
  });

  it('is disabled when no API key is configured', async () => {
    await request(createApp(prisma, unusedAi, undefined))
      .post('/webhooks/email-status')
      .set('X-Api-Key', 'anything')
      .send(email())
      .expect(503);
  });

  it('validates the payload', async () => {
    await send(email({ confidence: 3 })).expect(400);
    await send(email({ category: 'SPAM' })).expect(400);
  });

  it('moves the matched application and logs the email', async () => {
    const application = await createApplication({
      companyName: 'Acorn Labs',
      jobTitle: 'Frontend Engineer',
      status: 'APPLIED',
    });

    const response = await send(email()).expect(201);

    expect(response.body).toMatchObject({
      duplicate: false,
      event: {
        outcome: 'UPDATED',
        applicationId: application.id,
        previousStatus: 'APPLIED',
        newStatus: 'INTERVIEW_SCHEDULED',
      },
    });
    const updated = await prisma.jobApplication.findUnique({
      where: { id: application.id },
    });
    expect(updated?.status).toBe('INTERVIEW_SCHEDULED');

    const activity = await request(app)
      .get(`/applications/${application.id}/email-events`)
      .expect(200);
    expect(activity.body).toHaveLength(1);
    expect(activity.body[0]).toMatchObject({ subject: 'Interview invitation' });
  });

  it('processes the same email only once', async () => {
    const application = await createApplication({
      companyName: 'Acorn Labs',
      jobTitle: 'Frontend Engineer',
      status: 'SAVED',
    });

    await send(email({ category: 'APPLICATION_RECEIVED' })).expect(201);
    await prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: 'SAVED' },
    });
    const again = await send(email({ category: 'APPLICATION_RECEIVED' })).expect(200);

    expect(again.body.duplicate).toBe(true);
    expect(await prisma.emailEvent.count()).toBe(1);
    const unchanged = await prisma.jobApplication.findUnique({
      where: { id: application.id },
    });
    expect(unchanged?.status).toBe('SAVED');
  });

  it('does not move the board backwards', async () => {
    await createApplication({
      companyName: 'Acorn Labs',
      jobTitle: 'Frontend Engineer',
      status: 'INTERVIEW_SCHEDULED',
    });

    const response = await send(email({ category: 'APPLICATION_RECEIVED' })).expect(201);

    expect(response.body.event).toMatchObject({
      outcome: 'NO_CHANGE',
      newStatus: null,
    });
  });

  it('sends unsure or unclear emails to review instead of changing anything', async () => {
    const application = await createApplication({
      companyName: 'Acorn Labs',
      jobTitle: 'Frontend Engineer',
      status: 'APPLIED',
    });
    await createApplication({
      companyName: 'Acorn Labs',
      jobTitle: 'Data Analyst',
      status: 'APPLIED',
    });

    const lowConfidence = await send(
      email({ messageId: 'msg-low', confidence: 0.4 }),
    ).expect(201);
    const ambiguous = await send(
      email({ messageId: 'msg-ambiguous', jobTitle: null }),
    ).expect(201);

    expect(lowConfidence.body.event).toMatchObject({
      outcome: 'NEEDS_REVIEW',
      applicationId: application.id,
    });
    expect(ambiguous.body.event).toMatchObject({
      outcome: 'NEEDS_REVIEW',
      applicationId: null,
    });
    const statuses = await prisma.jobApplication.findMany({
      select: { status: true },
    });
    expect(statuses.every(({ status }) => status === 'APPLIED')).toBe(true);
  });

  it('logs emails from unknown companies as no match', async () => {
    const response = await send(email({ companyName: 'Birch AI' })).expect(201);

    expect(response.body.event).toMatchObject({
      outcome: 'NO_MATCH',
      applicationId: null,
    });
  });

  it('keeps the email log when the application is deleted', async () => {
    const application = await createApplication({
      companyName: 'Acorn Labs',
      jobTitle: 'Frontend Engineer',
      status: 'APPLIED',
    });
    await send(email()).expect(201);

    await request(app).delete(`/applications/${application.id}`).expect(204);

    const event = await prisma.emailEvent.findFirstOrThrow();
    expect(event.applicationId).toBeNull();
  });
});
