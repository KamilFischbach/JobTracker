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
import { deleteExpired } from '../../src/services/auth/cleanup.js';
import { hashPassword } from '../../src/services/auth/password.js';
import { buildDemoData } from '../../src/services/demo/demo-data.js';
import {
  createOutbox,
  FAILING_CAPTCHA,
  fakeCaptcha,
} from '../support/fake-auth.js';
import { startTestDatabase } from './database.js';
import { signIn } from './users.js';

const APP_URL = 'https://jobtracker.test';
const PASSWORD = 'a long enough passphrase';
const NEW_PASSWORD = 'another long passphrase';

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let outbox: ReturnType<typeof createOutbox>;

// The session cookie from a response, as a `Cookie` header value.
function cookieFrom(response: request.Response) {
  const header = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const session = header.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!session) throw new Error('The response sets no session cookie.');
  return session.split(';')[0] ?? '';
}

async function createVerifiedUser(email: string, password = PASSWORD) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
    },
  });
}

function login(email: string, password = PASSWORD) {
  return request(app).post('/auth/login').send({ email, password });
}

function me(cookie: string) {
  return request(app).get('/auth/me').set('Cookie', cookie);
}

describe('auth routes (PostgreSQL integration)', () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    prisma = database.prisma;
  }, 120_000);

  // A new app per test also resets the in-memory rate limits.
  beforeEach(() => {
    outbox = createOutbox();
    app = createApp({
      prisma,
      auth: { appUrl: APP_URL, captcha: fakeCaptcha(), email: outbox },
    });
  });

  afterEach(async () => {
    await prisma.emailEvent.deleteMany();
    await prisma.authToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await database?.stop();
  });

  describe('sign-up', () => {
    function signup(email: string, password = PASSWORD, captchaToken = 'ok') {
      return request(app).post('/auth/signup').send({ email, password, captchaToken });
    }

    it('emails a link and creates the account only when the link is opened', async () => {
      const response = await signup('  New.User@Example.com ').expect(202);
      expect(response.body.message).toMatch(/Check your inbox/);
      expect(await prisma.user.count()).toBe(0);

      expect(outbox.messages).toHaveLength(1);
      expect(outbox.messages[0]).toMatchObject({
        to: 'new.user@example.com',
        subject: 'Confirm your JobTracker account',
      });
      expect(outbox.messages[0]?.text).toContain(`${APP_URL}/confirm-signup#token=`);

      const confirmed = await request(app)
        .post('/auth/confirm-signup')
        .send({ token: outbox.lastLinkToken() })
        .expect(201);
      expect(confirmed.body).toEqual({
        id: expect.any(String),
        email: 'new.user@example.com',
        isDemo: false,
      });

      const cookie = cookieFrom(confirmed);
      expect((await me(cookie).expect(200)).body.email).toBe('new.user@example.com');
      await login('new.user@example.com').expect(200);
    });

    it('sets a secure, HttpOnly, SameSite=Lax session cookie', async () => {
      await signup('cookie@example.com');
      const confirmed = await request(app)
        .post('/auth/confirm-signup')
        .send({ token: outbox.lastLinkToken() });

      const header = String(confirmed.headers['set-cookie']);
      expect(header).toMatch(new RegExp(`^${SESSION_COOKIE}=[\\w-]{43};`));
      expect(header).toContain('Path=/');
      expect(header).toContain('HttpOnly');
      expect(header).toContain('Secure');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Expires=');
    });

    it('accepts each link once', async () => {
      await signup('once@example.com');
      const token = outbox.lastLinkToken();

      await request(app).post('/auth/confirm-signup').send({ token }).expect(201);
      const again = await request(app)
        .post('/auth/confirm-signup')
        .send({ token })
        .expect(400);
      expect(again.body.code).toBe('INVALID_LINK');
    });

    it('rejects expired links', async () => {
      await signup('late@example.com');
      await prisma.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      const response = await request(app)
        .post('/auth/confirm-signup')
        .send({ token: outbox.lastLinkToken() })
        .expect(400);
      expect(response.body.code).toBe('INVALID_LINK');
      expect(await prisma.user.count()).toBe(0);
    });

    it('answers the same for a registered address and emails its owner instead', async () => {
      await createVerifiedUser('taken@example.com');

      const response = await signup('taken@example.com', 'some other passphrase').expect(202);

      expect(response.body.message).toMatch(/Check your inbox/);
      expect(outbox.messages[0]?.subject).toBe('You already have a JobTracker account');
      expect(await prisma.authToken.count()).toBe(0);
      await login('taken@example.com').expect(200);
    });

    it('lets the inbox owner keep their own password when someone signed up with their address first', async () => {
      await signup('victim@example.com', 'attacker passphrase');
      await signup('victim@example.com', 'victims own passphrase');

      await request(app)
        .post('/auth/confirm-signup')
        .send({ token: outbox.lastLinkToken() })
        .expect(201);

      await login('victim@example.com', 'victims own passphrase').expect(200);
      await login('victim@example.com', 'attacker passphrase').expect(401);
      // The other pending link is gone with the confirmation.
      expect(await prisma.authToken.count()).toBe(0);
    });

    it.each([
      ['a short password', 'short pass', 'Use at least 12 characters.'],
      ['a common password', 'Password1234', 'This password is too common. Choose another one.'],
      ['a repeated character', 'aaaaaaaaaaaaaaaa', 'This password is too easy to guess. Choose another one.'],
    ])('rejects %s', async (_case, password, message) => {
      const response = await signup('weak@example.com', password).expect(400);
      expect(response.body.message).toBe(message);
      expect(outbox.messages).toHaveLength(0);
    });

    it('rejects an invalid email address', async () => {
      const response = await signup('not-an-email').expect(400);
      expect(response.body.message).toBe('Enter a valid email address.');
    });

    it('requires the CAPTCHA', async () => {
      const response = await signup('bot@example.com', PASSWORD, FAILING_CAPTCHA).expect(400);
      expect(response.body.code).toBe('CAPTCHA_FAILED');
      expect(outbox.messages).toHaveLength(0);
    });

    it('limits how many sign-up emails one address can trigger', async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await signup(`spam${attempt}@example.com`).expect(202);
      }
      const blocked = await signup('spam5@example.com').expect(429);
      expect(blocked.body.code).toBe('RATE_LIMITED');
      expect(blocked.headers.ratelimit).toBeDefined();
    });
  });

  describe('login and logout', () => {
    beforeEach(async () => {
      await createVerifiedUser('user@example.com');
    });

    it('logs in with the right password, ignoring the email case', async () => {
      const response = await login(' USER@example.com ').expect(200);
      expect(response.body).toMatchObject({ email: 'user@example.com', isDemo: false });
      await me(cookieFrom(response)).expect(200);
    });

    it('gives the same answer for a wrong password and an unknown address', async () => {
      const wrongPassword = await login('user@example.com', 'wrong passphrase!').expect(401);
      const unknownUser = await login('nobody@example.com').expect(401);

      expect(wrongPassword.body).toEqual(unknownUser.body);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('replaces the session the browser already had', async () => {
      const first = cookieFrom(await login('user@example.com'));
      const second = await request(app)
        .post('/auth/login')
        .set('Cookie', first)
        .send({ email: 'user@example.com', password: PASSWORD })
        .expect(200);

      await me(first).expect(401);
      await me(cookieFrom(second)).expect(200);
    });

    it('logs out: ends the session and clears the cookie', async () => {
      const cookie = cookieFrom(await login('user@example.com'));

      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      expect(String(response.headers['set-cookie'])).toMatch(
        new RegExp(`^${SESSION_COOKIE}=;.*Expires=Thu, 01 Jan 1970`),
      );
      await me(cookie).expect(401);
      expect(await prisma.session.count()).toBe(0);
    });

    it('blocks an address after 10 failed logins, but not the right password before that', async () => {
      for (let attempt = 0; attempt < 9; attempt++) {
        await login('user@example.com', 'wrong passphrase!').expect(401);
      }
      await login('user@example.com').expect(200);
      await login('user@example.com', 'wrong passphrase!').expect(401);

      const blocked = await login('user@example.com').expect(429);
      expect(blocked.body.code).toBe('RATE_LIMITED');
    });
  });

  describe('account settings', () => {
    let userId: string;
    let cookie: string;

    beforeEach(async () => {
      userId = (await createVerifiedUser('user@example.com')).id;
      cookie = cookieFrom(await login('user@example.com'));
    });

    function changePassword(currentPassword: string, as = cookie) {
      return request(app)
        .post('/auth/password')
        .set('Cookie', as)
        .send({ currentPassword, newPassword: NEW_PASSWORD });
    }

    it('changes the password and logs out the other sessions', async () => {
      const otherDevice = await signIn(prisma, userId);

      await changePassword(PASSWORD).expect(204);

      await me(cookie).expect(200);
      await me(otherDevice).expect(401);
      await login('user@example.com', PASSWORD).expect(401);
      await login('user@example.com', NEW_PASSWORD).expect(200);
    });

    it('needs the current password, answered with 400 so the client stays logged in', async () => {
      const response = await changePassword('wrong passphrase!').expect(400);
      expect(response.body.code).toBe('WRONG_PASSWORD');
      await login('user@example.com', PASSWORD).expect(200);
    });

    it('requires a session', async () => {
      await changePassword(PASSWORD, `${SESSION_COOKIE}=nope`).expect(401);
    });

    it('deletes the account with all its applications and emails', async () => {
      const { applications, emailEvents } = buildDemoData(userId);
      await prisma.jobApplication.createMany({ data: applications });
      await prisma.emailEvent.createMany({ data: emailEvents });

      const wrong = await request(app)
        .delete('/auth/account')
        .set('Cookie', cookie)
        .send({ password: 'wrong passphrase!' })
        .expect(400);
      expect(wrong.body.code).toBe('WRONG_PASSWORD');

      await request(app)
        .delete('/auth/account')
        .set('Cookie', cookie)
        .send({ password: PASSWORD })
        .expect(204);

      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.jobApplication.count()).toBe(0);
      expect(await prisma.emailEvent.count()).toBe(0);
      expect(await prisma.session.count()).toBe(0);
    });

    it('does not let demo accounts change a password or delete themselves', async () => {
      const demo = await prisma.user.create({
        data: { isDemo: true, expiresAt: new Date(Date.now() + 60_000) },
      });
      const demoCookie = await signIn(prisma, demo.id);

      const change = await changePassword('anything', demoCookie).expect(403);
      expect(change.body.code).toBe('DEMO_ACCOUNT');
      await request(app)
        .delete('/auth/account')
        .set('Cookie', demoCookie)
        .send({ password: 'anything' })
        .expect(403);
    });
  });

  describe('password reset', () => {
    function forgot(email: string, captchaToken = 'ok') {
      return request(app).post('/auth/forgot-password').send({ email, captchaToken });
    }

    function reset(token: string, password = NEW_PASSWORD) {
      return request(app).post('/auth/reset-password').send({ token, password });
    }

    let userId: string;

    beforeEach(async () => {
      userId = (await createVerifiedUser('user@example.com')).id;
    });

    it('sets a new password from the emailed link and logs out every session', async () => {
      const session = await signIn(prisma, userId);

      const response = await forgot('user@example.com').expect(202);
      expect(response.body.message).toMatch(/Check your inbox/);
      expect(outbox.messages[0]?.subject).toBe('Reset your JobTracker password');
      expect(outbox.messages[0]?.text).toContain(`${APP_URL}/reset-password#token=`);

      await reset(outbox.lastLinkToken()).expect(204);

      await me(session).expect(401);
      await login('user@example.com', PASSWORD).expect(401);
      await login('user@example.com', NEW_PASSWORD).expect(200);
    });

    it('answers the same for unknown addresses and tells that inbox there is no account', async () => {
      const known = await forgot('user@example.com').expect(202);
      const unknown = await forgot('nobody@example.com').expect(202);

      expect(unknown.body).toEqual(known.body);
      expect(outbox.messages[1]).toMatchObject({
        to: 'nobody@example.com',
        subject: 'JobTracker password reset',
      });
      expect(outbox.messages[1]?.text).not.toContain('#token=');
    });

    it('accepts each link once and only the newest one', async () => {
      await forgot('user@example.com');
      const older = outbox.lastLinkToken();
      await forgot('user@example.com');
      const newer = outbox.lastLinkToken();

      expect((await reset(older).expect(400)).body.code).toBe('INVALID_LINK');
      await reset(newer).expect(204);
      await reset(newer, 'yet another passphrase').expect(400);
    });

    it('rejects expired links', async () => {
      await forgot('user@example.com');
      await prisma.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      await reset(outbox.lastLinkToken()).expect(400);
      await login('user@example.com', PASSWORD).expect(200);
    });

    it('does not accept a sign-up link as a reset link', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ email: 'new@example.com', password: PASSWORD, captchaToken: 'ok' });

      await reset(outbox.lastLinkToken()).expect(400);
    });

    it('applies the password rules to the new password', async () => {
      await forgot('user@example.com');
      const response = await reset(outbox.lastLinkToken(), 'short').expect(400);
      expect(response.body.message).toBe('Use at least 12 characters.');
    });

    it('requires the CAPTCHA', async () => {
      const response = await forgot('user@example.com', FAILING_CAPTCHA).expect(400);
      expect(response.body.code).toBe('CAPTCHA_FAILED');
      expect(outbox.messages).toHaveLength(0);
    });
  });

  describe('cross-site requests', () => {
    beforeEach(async () => {
      await createVerifiedUser('user@example.com');
    });

    it('rejects a POST from another origin', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: 'user@example.com', password: PASSWORD })
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN_ORIGIN');
    });

    it('rejects a POST the browser marks as cross-site', async () => {
      await request(app)
        .post('/auth/login')
        .set('Sec-Fetch-Site', 'cross-site')
        .send({ email: 'user@example.com', password: PASSWORD })
        .expect(403);
    });

    it('accepts requests from the app itself', async () => {
      await request(app)
        .post('/auth/login')
        .set('Origin', APP_URL)
        .set('Sec-Fetch-Site', 'same-origin')
        .send({ email: 'user@example.com', password: PASSWORD })
        .expect(200);
    });
  });

  describe('cleanup of expired data', () => {
    it('deletes expired sessions, links and demo accounts with their data, and keeps the rest', async () => {
      const past = new Date(Date.now() - 1000);
      const future = new Date(Date.now() + 60_000);
      const user = await createVerifiedUser('user@example.com');
      const activeDemo = await prisma.user.create({ data: { isDemo: true, expiresAt: future } });
      const expiredDemo = await prisma.user.create({ data: { isDemo: true, expiresAt: past } });
      const { applications, emailEvents } = buildDemoData(expiredDemo.id);
      await prisma.jobApplication.createMany({ data: applications });
      await prisma.emailEvent.createMany({ data: emailEvents });

      await signIn(prisma, user.id);
      await prisma.session.create({ data: { id: 'expired', userId: user.id, expiresAt: past } });
      await prisma.authToken.create({
        data: { id: 'expired', purpose: 'SIGNUP', email: 'x@example.com', passwordHash: 'x', expiresAt: past },
      });

      expect(await deleteExpired(prisma)).toEqual({
        sessions: 1,
        tokens: 1,
        demoUsers: 1,
        aiUsages: 0,
      });

      expect(await prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).toEqual(
        [{ id: user.id }, { id: activeDemo.id }].sort((a, b) => a.id.localeCompare(b.id)),
      );
      expect(await prisma.session.count()).toBe(1);
      expect(await prisma.jobApplication.count()).toBe(0);
      expect(await prisma.emailEvent.count()).toBe(0);
    });
  });
});
