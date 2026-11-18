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
import { MAX_ACTIVE_DEMO_ACCOUNTS } from '../../src/services/auth/auth-service.js';
import { buildDemoData } from '../../src/services/demo/demo-data.js';
import { FAILING_CAPTCHA, createOutbox, fakeCaptcha } from '../support/fake-auth.js';
import { startTestDatabase } from './database.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_APPLICATION_COUNT = buildDemoData('count').applications.length;

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;

function startDemo(captchaToken = 'ok', cookie?: string) {
  const call = request(app).post('/auth/demo').send({ captchaToken });
  return cookie ? call.set('Cookie', cookie) : call;
}

function cookieFrom(response: request.Response) {
  const header = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  return header.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`)) ?? '';
}

describe('"Try demo" accounts (PostgreSQL integration)', () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    prisma = database.prisma;
  }, 120_000);

  // A new app per test resets the in-memory rate limits.
  beforeEach(() => {
    app = createApp({
      prisma,
      auth: { appUrl: 'https://jobtracker.test', captcha: fakeCaptcha(), email: createOutbox() },
    });
  });

  afterEach(async () => {
    await prisma.emailEvent.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await database?.stop();
  });

  it('creates a temporary account with its own copy of the demo applications', async () => {
    const response = await startDemo().expect(201);
    expect(response.body).toEqual({ id: expect.any(String), email: null, isDemo: true });

    const cookie = cookieFrom(response).split(';')[0] ?? '';
    const me = await request(app).get('/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.isDemo).toBe(true);

    const board = await request(app).get('/applications').set('Cookie', cookie).expect(200);
    expect(board.body).toHaveLength(DEMO_APPLICATION_COUNT);
    expect(board.body.every((a: { userId: string }) => a.userId === response.body.id)).toBe(true);
  });

  it('gives each visitor separate data', async () => {
    const first = cookieFrom(await startDemo()).split(';')[0] ?? '';
    const second = cookieFrom(await startDemo()).split(';')[0] ?? '';

    const [firstApp] = (await request(app).get('/applications').set('Cookie', first)).body;
    await request(app).delete(`/applications/${firstApp.id}`).set('Cookie', first).expect(204);

    const secondBoard = await request(app).get('/applications').set('Cookie', second);
    expect(secondBoard.body).toHaveLength(DEMO_APPLICATION_COUNT);
  });

  it('ends account and cookie after 24 hours', async () => {
    const before = Date.now();
    const response = await startDemo();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: response.body.id } });
    const lifetime = (user.expiresAt?.getTime() ?? 0) - before;
    expect(lifetime).toBeGreaterThan(DAY_MS - 60_000);
    expect(lifetime).toBeLessThanOrEqual(DAY_MS + 60_000);

    const expires = Date.parse(cookieFrom(response).match(/Expires=([^;]+)/)?.[1] ?? '');
    expect(Math.abs(expires - (user.expiresAt?.getTime() ?? 0))).toBeLessThan(1000);
  });

  it('deletes the demo account and its data on logout', async () => {
    const cookie = cookieFrom(await startDemo()).split(';')[0] ?? '';

    await request(app).post('/auth/logout').set('Cookie', cookie).expect(204);

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.jobApplication.count()).toBe(0);
    expect(await prisma.emailEvent.count()).toBe(0);
  });

  it('replaces the session the browser already had', async () => {
    const first = cookieFrom(await startDemo()).split(';')[0] ?? '';
    await startDemo('ok', first).expect(201);

    await request(app).get('/auth/me').set('Cookie', first).expect(401);
  });

  it('requires the CAPTCHA', async () => {
    const response = await startDemo(FAILING_CAPTCHA).expect(400);
    expect(response.body.code).toBe('CAPTCHA_FAILED');
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses new demo accounts while too many are active', async () => {
    const expiresAt = new Date(Date.now() + DAY_MS);
    await prisma.user.createMany({
      data: Array.from({ length: MAX_ACTIVE_DEMO_ACCOUNTS }, () => ({ isDemo: true, expiresAt })),
    });

    const response = await startDemo().expect(503);
    expect(response.body.code).toBe('DEMO_UNAVAILABLE');
  });

  it('allows 5 demo accounts per address per day', async () => {
    for (let i = 0; i < 5; i++) await startDemo().expect(201);

    const blocked = await startDemo().expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
  });
});
