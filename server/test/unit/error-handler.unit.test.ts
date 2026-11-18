import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOllamaClient, LlmUnavailableError } from '../../src/services/ai/llm.js';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { fakeSessions, SIGNED_IN_COOKIE } from '../support/fake-auth.js';

const unusedAi = {
  llm: { generateJson: async () => '' },
  fetchPage: async () => {
    throw new Error('not used');
  },
};

// An app whose application queries all fail with `error`, with a fake
// session store so requests with SIGNED_IN_COOKIE are logged in.
function failingApp(error: unknown) {
  return createApp({
    prisma: failingPrisma(error),
    sessions: fakeSessions(),
    ai: unusedAi,
  });
}

function failingPrisma(error: unknown) {
  const fail = async () => {
    throw error;
  };
  return {
    jobApplication: { findMany: fail, findFirst: fail, update: fail },
  } as unknown as PrismaClient;
}

describe('error handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers malformed JSON with 400 and a JSON message', async () => {
    const app = failingApp(new Error('unused'));

    const response = await request(app)
      .post('/applications')
      .set('Cookie', SIGNED_IN_COOKIE)
      .set('Content-Type', 'application/json')
      .send('{"companyName": ')
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      message: 'The request body is not valid JSON.',
    });
  });

  it.each([
    ['POST', '/applications', { companyName: 'Acorn Labs' }],
    ['PATCH', '/applications/abc', {}],
    ['DELETE', '/applications', { ids: [] }],
    ['POST', '/ai/parse-offer', { url: 'not a link' }],
  ])(
    'answers invalid input to %s %s with 400 { message, errors }',
    async (method, path, body) => {
      const app = failingApp(new Error('unused'));

      const response = await request(app)
        [method.toLowerCase() as 'post' | 'patch' | 'delete'](path)
        .set('Cookie', SIGNED_IN_COOKIE)
        .send(body)
        .expect(400);

      expect(response.body.message).toEqual(expect.any(String));
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ message: response.body.message })]),
      );
    },
  );

  it('answers unexpected errors with 500, logs them and hides the details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('connection to database lost');
    const app = failingApp(error);

    const response = await request(app)
      .get('/applications')
      .set('Cookie', SIGNED_IN_COOKIE)
      .expect(500)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      message: 'Something went wrong on the server. Try again.',
    });
    expect(JSON.stringify(response.body)).not.toContain('database');
    expect(log).toHaveBeenCalledWith(error);
  });

  it('answers requests without a session with 401 before touching the database', async () => {
    const app = failingApp(new Error('must not be reached'));

    const response = await request(app).get('/applications').expect(401);

    expect(response.body).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Log in to continue.',
    });
  });

  it('answers a record deleted mid-request (Prisma P2025) with 404', async () => {
    const app = failingApp(Object.assign(new Error('gone'), { code: 'P2025' }));

    const response = await request(app)
      .get('/applications/abc')
      .set('Cookie', SIGNED_IN_COOKIE)
      .expect(404);

    expect(response.body).toEqual({ message: 'The record no longer exists.' });
  });
});

describe('Ollama client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a non-JSON reply as AI unavailable instead of crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>proxy error</html>')),
    );
    const llm = createOllamaClient({
      baseUrl: 'http://ollama.test',
      model: 'test-model',
    });

    await expect(
      llm.generateJson({ messages: [], schema: {} }),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
  });
});
