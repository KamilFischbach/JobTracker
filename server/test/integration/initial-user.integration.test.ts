import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { ensureInitialUser } from '../../src/services/auth/initial-user.js';
import { createOutbox, fakeCaptcha } from '../support/fake-auth.js';
import { startTestDatabase } from './database.js';

const ACCOUNT = { email: 'owner@example.com', password: 'a-strong-start-password' };

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let prisma: PrismaClient;

function logIn(password: string) {
  const app = createApp({
    prisma,
    auth: { appUrl: 'https://jobtracker.test', captcha: fakeCaptcha(), email: createOutbox() },
  });
  return request(app).post('/auth/login').send({ email: ACCOUNT.email, password });
}

describe('initial account from INITIAL_USER_* (PostgreSQL integration)', () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    prisma = database.prisma;
  }, 120_000);

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await database?.stop();
  });

  it('creates a verified account that can log in straight away', async () => {
    await expect(ensureInitialUser(prisma, ACCOUNT)).resolves.toBe('created');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNT.email } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.isDemo).toBe(false);
    await logIn(ACCOUNT.password).expect(200);
  });

  it('leaves an existing account and its password alone', async () => {
    await ensureInitialUser(prisma, ACCOUNT);

    await expect(
      ensureInitialUser(prisma, { ...ACCOUNT, password: 'another-long-password' }),
    ).resolves.toBe('exists');

    expect(await prisma.user.count()).toBe(1);
    await logIn(ACCOUNT.password).expect(200);
    await logIn('another-long-password').expect(401);
  });
});
