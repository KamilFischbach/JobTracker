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
import type { AiLimits } from '../../src/services/ai/ai-usage.js';
import type { JobPage } from '../../src/services/ai/fetch-page.js';
import { PageFetchError } from '../../src/services/ai/fetch-page.js';
import { type LlmClient, LlmUnavailableError } from '../../src/services/ai/llm.js';
import { deleteUsers } from '../../src/services/auth/delete-users.js';
import { deleteExpired } from '../../src/services/auth/cleanup.js';
import { startTestDatabase } from './database.js';
import { createUser, signIn } from './users.js';

const OFFER_URL = 'https://jobs.example.com/offer/1';
const LIMITS: AiLimits = { perUser: 2, perDemoIp: 3, demoTotal: 4, total: 6 };

const page: JobPage = {
  url: OFFER_URL,
  title: 'Frontend Developer at Acorn Labs',
  structuredData: null,
  text: 'Acorn Labs is hiring a Frontend Developer. '.repeat(10),
};

const answer = JSON.stringify({
  companyName: 'Acorn Labs',
  jobTitle: 'Frontend Developer',
  salaryMin: null,
  salaryMax: null,
  currency: null,
  salaryPeriod: null,
  contractType: null,
  location: null,
  workMode: null,
  technologies: [],
  summary: null,
  isJobOffer: true,
});

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let prisma: PrismaClient;
let llm: LlmClient;
let fetchPage: (url: string) => Promise<JobPage>;

function buildApp() {
  return createApp({
    prisma,
    ai: { llm: { generateJson: (input) => llm.generateJson(input) }, fetchPage: (url) => fetchPage(url) },
    aiUsage: { limits: LIMITS, ipHashSecret: 'test-secret' },
    // Lets the tests pick the client address with X-Forwarded-For.
    trustProxy: 1,
    rateLimits: false,
  });
}

function importOffer(app: ReturnType<typeof createApp>, cookie: string, ip = '203.0.113.1') {
  return request(app)
    .post('/ai/parse-offer')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', ip)
    .send({ url: OFFER_URL });
}

async function createDemoUser() {
  const user = await prisma.user.create({
    data: { isDemo: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return { id: user.id, cookie: await signIn(prisma, user.id) };
}

describe('AI import limits (PostgreSQL integration)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    database = await startTestDatabase();
    prisma = database.prisma;
  }, 120_000);

  beforeEach(() => {
    llm = { generateJson: async () => answer };
    fetchPage = async () => page;
    app = buildApp();
  });

  afterEach(async () => {
    await prisma.aiUsage.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await database?.stop();
  });

  describe('registered users', () => {
    let cookie: string;

    beforeEach(async () => {
      const user = await createUser(prisma, 'user@example.com');
      cookie = await signIn(prisma, user.id);
    });

    it('get their daily number of imports, then a clear 429', async () => {
      await importOffer(app, cookie).expect(200);
      await importOffer(app, cookie).expect(200);

      const blocked = await importOffer(app, cookie).expect(429);
      expect(blocked.body).toEqual({
        code: 'AI_LIMIT_REACHED',
        message: 'You have used all 2 AI imports for today. More become available within 24 hours.',
      });

      const usage = await request(app).get('/ai/usage').set('Cookie', cookie).expect(200);
      expect(usage.body).toEqual({ used: 2, limit: 2 });
    });

    it('are counted per account, not per address', async () => {
      const other = await createUser(prisma, 'other@example.com');
      const otherCookie = await signIn(prisma, other.id);

      await importOffer(app, cookie).expect(200);
      await importOffer(app, cookie).expect(200);
      await importOffer(app, otherCookie).expect(200);
    });

    it('get the import back when the AI service is down', async () => {
      llm = {
        generateJson: async () => {
          throw new LlmUnavailableError('Cannot reach the AI service. Try again later.');
        },
      };
      await importOffer(app, cookie).expect(503);

      const usage = await request(app).get('/ai/usage').set('Cookie', cookie);
      expect(usage.body.used).toBe(0);
    });

    it('do not use an import when the page cannot be downloaded', async () => {
      fetchPage = async () => {
        throw new PageFetchError('The site blocked the download.');
      };
      await importOffer(app, cookie).expect(422);

      expect(await prisma.aiUsage.count()).toBe(0);
    });

    it('do use an import when the model answers badly, since it cost tokens', async () => {
      llm = { generateJson: async () => 'not json' };
      await importOffer(app, cookie).expect(502);

      expect(await prisma.aiUsage.count()).toBe(1);
    });
  });

  describe('demo accounts', () => {
    it('share 3 imports per address, even across demo accounts', async () => {
      const first = await createDemoUser();
      const second = await createDemoUser();

      await importOffer(app, first.cookie).expect(200);
      await importOffer(app, first.cookie).expect(200);
      await importOffer(app, second.cookie).expect(200);

      const blocked = await importOffer(app, second.cookie).expect(429);
      expect(blocked.body.message).toBe(
        'The demo allows 3 AI imports per day. Create a free account for more.',
      );
      // Another address still has its own imports.
      await importOffer(app, second.cookie, '198.51.100.9').expect(200);
    });

    it('count IPv6 addresses of one /64 network together', async () => {
      const demo = await createDemoUser();

      await importOffer(app, demo.cookie, '2001:db8:1:2::1').expect(200);
      await importOffer(app, demo.cookie, '2001:db8:1:2::2').expect(200);
      await importOffer(app, demo.cookie, '2001:db8:1:2::3').expect(200);
      await importOffer(app, demo.cookie, '2001:db8:1:2::4').expect(429);
    });

    it('keep the limit after the demo account is deleted', async () => {
      const first = await createDemoUser();
      for (let i = 0; i < 3; i++) await importOffer(app, first.cookie).expect(200);
      await deleteUsers(prisma, { id: first.id });

      const next = await createDemoUser();
      await importOffer(app, next.cookie).expect(429);
    });

    it('stop when all demo accounts together reach their daily cap', async () => {
      const demo = await createDemoUser();
      for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3', '198.51.100.4']) {
        await importOffer(app, demo.cookie, ip).expect(200);
      }

      const blocked = await importOffer(app, demo.cookie, '198.51.100.5').expect(429);
      expect(blocked.body.message).toBe(
        'The AI import has reached its daily limit. Try again tomorrow.',
      );
    });

    it('show their remaining imports for their address', async () => {
      const demo = await createDemoUser();
      await importOffer(app, demo.cookie).expect(200);

      const usage = await request(app)
        .get('/ai/usage')
        .set('Cookie', demo.cookie)
        .set('X-Forwarded-For', '203.0.113.1');
      expect(usage.body).toEqual({ used: 1, limit: 3 });
    });
  });

  it('stops everyone at the total daily cap', async () => {
    const users = await Promise.all(
      [1, 2, 3, 4].map(async (n) => {
        const user = await createUser(prisma, `user${n}@example.com`);
        return signIn(prisma, user.id);
      }),
    );
    for (const cookie of users.slice(0, 3)) {
      await importOffer(app, cookie).expect(200);
      await importOffer(app, cookie).expect(200);
    }

    const blocked = await importOffer(app, users[3] ?? '').expect(429);
    expect(blocked.body.message).toMatch(/daily limit/);
  });

  it('never stores the client address', async () => {
    const user = await createUser(prisma, 'user@example.com');
    await importOffer(app, await signIn(prisma, user.id), '203.0.113.77').expect(200);

    const [row] = await prisma.aiUsage.findMany();
    expect(JSON.stringify(row)).not.toContain('203.0.113.77');
  });

  it('cleanup removes usage older than 24 hours', async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000);
    await prisma.aiUsage.createMany({
      data: [
        { isDemo: true, ipKey: 'old', createdAt: dayAgo },
        { isDemo: true, ipKey: 'recent' },
      ],
    });

    expect((await deleteExpired(prisma)).aiUsages).toBe(1);
    expect(await prisma.aiUsage.count()).toBe(1);
  });
});
