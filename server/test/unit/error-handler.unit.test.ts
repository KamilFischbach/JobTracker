import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOllamaClient, LlmUnavailableError } from '../../src/services/ai/llm.js';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const unusedAi = {
  llm: { generateJson: async () => '' },
  fetchPage: async () => {
    throw new Error('not used');
  },
};

// A Prisma client whose application queries all fail with `error`.
function failingPrisma(error: unknown) {
  const fail = async () => {
    throw error;
  };
  return {
    jobApplication: { findMany: fail, findUnique: fail, update: fail },
  } as unknown as PrismaClient;
}

describe('error handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers malformed JSON with 400 and a JSON message', async () => {
    const app = createApp(failingPrisma(new Error('unused')), unusedAi);

    const response = await request(app)
      .post('/applications')
      .set('Content-Type', 'application/json')
      .send('{"companyName": ')
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      message: 'The request body is not valid JSON.',
    });
  });

  it('answers unexpected errors with 500, logs them and hides the details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('connection to database lost');
    const app = createApp(failingPrisma(error), unusedAi);

    const response = await request(app)
      .get('/applications')
      .expect(500)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      message: 'Something went wrong on the server. Try again.',
    });
    expect(JSON.stringify(response.body)).not.toContain('database');
    expect(log).toHaveBeenCalledWith(error);
  });

  it('answers a record deleted mid-request (Prisma P2025) with 404', async () => {
    const app = createApp(
      failingPrisma(Object.assign(new Error('gone'), { code: 'P2025' })),
      unusedAi,
    );

    const response = await request(app).get('/applications/abc').expect(404);

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
