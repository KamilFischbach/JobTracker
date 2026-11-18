import { afterEach, describe, expect, it, vi } from 'vitest';
import { ipKey } from '../../src/services/ai/ai-usage.js';
import { LlmUnavailableError } from '../../src/services/ai/llm.js';
import { createOpenAiCompatibleClient } from '../../src/services/ai/openai-compatible.js';

function jsonResponse(
  body: object,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const request = {
  messages: [{ role: 'user' as const, content: 'Read this offer.' }],
  schema: { type: 'object', additionalProperties: false },
};

function client(fetchFn: typeof fetch, reasoningEffort?: 'low') {
  return createOpenAiCompatibleClient({
    baseUrl: 'https://api.groq.com/openai/v1/',
    apiKey: 'gsk_test',
    model: 'openai/gpt-oss-20b',
    reasoningEffort,
    fetchFn,
  });
}

function sentBody(fetchFn: ReturnType<typeof vi.fn>) {
  const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe('OpenAI-compatible client (Groq)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for strict JSON-schema output and returns the answer', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] }),
    );

    expect(await client(fetchFn, 'low').generateJson(request)).toBe(
      '{"ok":true}',
    );

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer gsk_test' });
    expect(sentBody(fetchFn)).toMatchObject({
      model: 'openai/gpt-oss-20b',
      messages: request.messages,
      temperature: 0,
      reasoning_effort: 'low',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'job_offer', strict: true, schema: request.schema },
      },
    });
  });

  it('leaves out reasoning_effort for models without reasoning', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: '{}' } }] }),
    );
    await client(fetchFn).generateJson(request);

    expect(sentBody(fetchFn)).not.toHaveProperty('reasoning_effort');
  });

  it('returns output that failed the schema, so the caller can retry', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: 'json_validate_failed',
            failed_generation: '{"broken":',
          },
        },
        400,
      ),
    );
    expect(await client(fetchFn).generateJson(request)).toBe('{"broken":');
  });

  it('reports the wait time when rate limited', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ error: { message: 'Rate limit reached' } }, 429, {
        'retry-after': '7',
      }),
    );
    await expect(client(fetchFn).generateJson(request)).rejects.toThrow(
      new LlmUnavailableError('The AI service is busy. Try again in 7 seconds.'),
    );
  });

  it('hides a rejected API key from the user but logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () =>
      jsonResponse({ error: { message: 'Invalid API Key' } }, 401),
    );

    await expect(client(fetchFn).generateJson(request)).rejects.toThrow(
      'The AI import is not configured correctly.',
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('LLM_API_KEY'));
  });

  it('reports an unreachable service', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(client(fetchFn).generateJson(request)).rejects.toBeInstanceOf(
      LlmUnavailableError,
    );
  });
});

describe('ipKey', () => {
  it('never contains the address and depends on the secret', () => {
    const key = ipKey('203.0.113.7', 'secret');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('203');
    expect(ipKey('203.0.113.7', 'secret')).toBe(key);
    expect(ipKey('203.0.113.7', 'other secret')).not.toBe(key);
    expect(ipKey('203.0.113.8', 'secret')).not.toBe(key);
  });

  it('groups IPv6 addresses by their /64 network', () => {
    expect(ipKey('2001:db8:1:2::1', 's')).toBe(ipKey('2001:db8:1:2:ffff::9', 's'));
    expect(ipKey('2001:db8:1:2::1', 's')).not.toBe(ipKey('2001:db8:1:3::1', 's'));
  });

  it('treats an IPv4-mapped IPv6 address like the IPv4 address', () => {
    expect(ipKey('::ffff:127.0.0.1', 's')).toBe(ipKey('127.0.0.1', 's'));
  });

  it('gives requests without an address one shared key', () => {
    expect(ipKey(undefined, 's')).toBe(ipKey('not an ip', 's'));
  });
});
