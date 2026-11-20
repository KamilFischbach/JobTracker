import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { SESSION_COOKIE } from '../../src/middleware/require-auth.js';
import {
  createSessionService,
  SESSION_DURATION_MS,
} from '../../src/services/auth/session-service.js';
import { startTestDatabase } from './database.js';
import { createUser, signIn } from './users.js';

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;

// Alice is the logged-in user; Bob owns data Alice must never reach.
let alice: { id: string; cookie: string };
let bob: { id: string; cookie: string };

function createApplication(
  userId: string,
  data: { companyName: string; jobTitle: string; salaryMin?: number; salaryMax?: number },
) {
  return prisma.jobApplication.create({ data: { ...data, userId } });
}

describe('applications routes (PostgreSQL integration)', () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    prisma = database.prisma;
    app = createApp({ prisma });
  }, 120_000);

  beforeEach(async () => {
    const aliceUser = await createUser(prisma, 'alice@example.com');
    const bobUser = await createUser(prisma, 'bob@example.com');
    alice = { id: aliceUser.id, cookie: await signIn(prisma, aliceUser.id) };
    bob = { id: bobUser.id, cookie: await signIn(prisma, bobUser.id) };
  });

  afterEach(async () => {
    // Applications and sessions are deleted with their users.
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await database?.stop();
  });

  describe('as the owner', () => {
    it('creates an application, applies database defaults, and returns it from GET', async () => {
      const created = await request(app)
        .post('/applications')
        .set('Cookie', alice.cookie)
        .send({
          companyName: 'Integration Labs',
          jobTitle: 'React Engineer',
          appliedDate: '2026-10-15',
        })
        .expect(201);

      expect(created.body).toMatchObject({
        userId: alice.id,
        companyName: 'Integration Labs',
        jobTitle: 'React Engineer',
        status: 'SAVED',
        currency: 'PLN',
        appliedDate: '2026-10-15T00:00:00.000Z',
      });

      const list = await request(app)
        .get('/applications')
        .set('Cookie', alice.cookie)
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].id).toBe(created.body.id);
    });

    it('ignores a userId sent in the body', async () => {
      const created = await request(app)
        .post('/applications')
        .set('Cookie', alice.cookie)
        .send({ companyName: 'Sneaky', jobTitle: 'Engineer', userId: bob.id })
        .expect(201);

      expect(created.body.userId).toBe(alice.id);
    });

    it('rejects invalid creates and salary-inverting partial updates', async () => {
      await request(app)
        .post('/applications')
        .set('Cookie', alice.cookie)
        .send({ companyName: ' ', jobTitle: 'Engineer' })
        .expect(400);

      const invertedRange = await request(app)
        .post('/applications')
        .set('Cookie', alice.cookie)
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

      const created = await createApplication(alice.id, {
        companyName: 'Range Test',
        jobTitle: 'Engineer',
        salaryMin: 15000,
        salaryMax: 18000,
      });

      await request(app)
        .patch(`/applications/${created.id}`)
        .set('Cookie', alice.cookie)
        .send({ salaryMax: 14000 })
        .expect(400);

      const unchanged = await prisma.jobApplication.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(Number(unchanged.salaryMax)).toBe(18000);
    });

    it('updates status and returns 404 for a missing application', async () => {
      const created = await createApplication(alice.id, {
        companyName: 'Status Test',
        jobTitle: 'Engineer',
      });

      const updated = await request(app)
        .patch(`/applications/${created.id}`)
        .set('Cookie', alice.cookie)
        .send({ status: 'INTERVIEW_SCHEDULED' })
        .expect(200);
      expect(updated.body.status).toBe('INTERVIEW_SCHEDULED');

      await request(app)
        .get('/applications/does-not-exist')
        .set('Cookie', alice.cookie)
        .expect(404);
    });

    it('deletes one application and a batch through their route contracts', async () => {
      const first = await createApplication(alice.id, { companyName: 'Delete One', jobTitle: 'Engineer' });
      const second = await createApplication(alice.id, { companyName: 'Delete Two', jobTitle: 'Engineer' });
      const third = await createApplication(alice.id, { companyName: 'Delete Three', jobTitle: 'Engineer' });

      await request(app)
        .delete(`/applications/${first.id}`)
        .set('Cookie', alice.cookie)
        .expect(204);
      const batch = await request(app)
        .delete('/applications')
        .set('Cookie', alice.cookie)
        .send({ ids: [second.id, third.id] })
        .expect(200);

      expect(batch.body.deletedCount).toBe(2);
      expect(await prisma.jobApplication.count()).toBe(0);
    });
  });

  describe("another user's applications", () => {
    let bobsApplication: { id: string };

    beforeEach(async () => {
      bobsApplication = await createApplication(bob.id, {
        companyName: 'Bob Corp',
        jobTitle: 'Engineer',
      });
    });

    it('are not listed', async () => {
      await createApplication(alice.id, { companyName: 'Alice Inc', jobTitle: 'Engineer' });

      const list = await request(app)
        .get('/applications')
        .set('Cookie', alice.cookie)
        .expect(200);

      expect(list.body.map((a: { companyName: string }) => a.companyName)).toEqual(['Alice Inc']);
    });

    it.each([
      ['GET', ''],
      ['GET', '/email-events'],
      ['PATCH', ''],
      ['DELETE', ''],
    ])('answer %s /applications/:id%s with 404, as if they did not exist', async (method, suffix) => {
      const response = await request(app)
        [method.toLowerCase() as 'get' | 'patch' | 'delete'](`/applications/${bobsApplication.id}${suffix}`)
        .set('Cookie', alice.cookie)
        .send(method === 'PATCH' ? { status: 'REJECTED' } : undefined)
        .expect(404);

      expect(response.body).toEqual({ message: 'Application not found.' });
    });

    it('are left unchanged by the attempts', async () => {
      await request(app)
        .patch(`/applications/${bobsApplication.id}`)
        .set('Cookie', alice.cookie)
        .send({ status: 'REJECTED' });
      await request(app)
        .delete(`/applications/${bobsApplication.id}`)
        .set('Cookie', alice.cookie);

      const stored = await prisma.jobApplication.findUniqueOrThrow({
        where: { id: bobsApplication.id },
      });
      expect(stored.status).toBe('SAVED');
    });

    it('are skipped by a batch delete', async () => {
      const own = await createApplication(alice.id, { companyName: 'Alice Inc', jobTitle: 'Engineer' });

      const batch = await request(app)
        .delete('/applications')
        .set('Cookie', alice.cookie)
        .send({ ids: [own.id, bobsApplication.id] })
        .expect(200);

      expect(batch.body.deletedCount).toBe(1);
      expect(await prisma.jobApplication.count({ where: { userId: bob.id } })).toBe(1);
    });
  });

  describe('without a valid session', () => {
    async function expectUnauthenticated(cookie?: string) {
      const call = request(app).get('/applications');
      const response = await (cookie ? call.set('Cookie', cookie) : call).expect(401);
      expect(response.body).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'Log in to continue.',
      });
    }

    it('answers 401 without a cookie', async () => {
      await expectUnauthenticated();
    });

    it('answers 401 for an unknown token', async () => {
      await expectUnauthenticated(`${SESSION_COOKIE}=made-up-token`);
    });

    it('answers 401 for an expired session and deletes it', async () => {
      const longAgo = () => new Date(Date.now() - SESSION_DURATION_MS - 1000);
      const { token } = await createSessionService(prisma, longAgo).create(alice.id);

      await expectUnauthenticated(`${SESSION_COOKIE}=${token}`);
      // Only the session from beforeEach is left.
      expect(await prisma.session.count({ where: { userId: alice.id } })).toBe(1);
    });

    it('answers 401 for an account whose email is not verified', async () => {
      const unverified = await prisma.user.create({
        data: { email: 'new@example.com', passwordHash: 'not-used' },
      });
      await expectUnauthenticated(await signIn(prisma, unverified.id));
    });

    it('answers 401 for an expired demo account', async () => {
      const demo = await prisma.user.create({
        data: { isDemo: true, expiresAt: new Date(Date.now() - 1000) },
      });
      await expectUnauthenticated(await signIn(prisma, demo.id));
    });

    it('answers 401 after logging out', async () => {
      const token = alice.cookie.split('=')[1] ?? '';
      await createSessionService(prisma).invalidate(token);
      await expectUnauthenticated(alice.cookie);
    });

    it('protects the AI import too', async () => {
      await request(app)
        .post('/ai/parse-offer')
        .send({ url: 'https://example.com/job' })
        .expect(401);
    });
  });

  describe('users table', () => {
    it('requires email and password for accounts that are not demo accounts', async () => {
      await expect(
        prisma.user.create({ data: { email: 'no-password@example.com' } }),
      ).rejects.toThrow();
      await expect(
        prisma.user.create({ data: { isDemo: true } }),
      ).resolves.toMatchObject({ email: null, passwordHash: null });
    });
  });
});
