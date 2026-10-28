import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  extractPageContent,
  fetchJobPage,
  type JobPage,
  PageFetchError,
} from '../../src/ai/fetch-page.js';
import { type LlmClient, LlmUnavailableError } from '../../src/ai/llm.js';
import {
  type ExtractedOffer,
  extractOffer,
  InvalidLlmOutputError,
  NotAJobOfferError,
  toOfferDraft,
} from '../../src/ai/parse-offer.js';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const offer: ExtractedOffer = {
  companyName: 'Acorn Labs',
  jobTitle: 'Junior AI Automation Developer',
  salaryMin: 8000,
  salaryMax: 11000,
  currency: 'PLN',
  salaryPeriod: 'MONTH',
  contractType: 'B2B',
  location: 'Warsaw',
  workMode: 'HYBRID',
  technologies: ['n8n', 'TypeScript'],
  summary: 'Builds AI automations for sales teams.',
  isJobOffer: true,
};

const page: JobPage = {
  url: 'https://jobs.example.com/offer/1',
  title: 'Junior AI Automation Developer',
  structuredData: null,
  text: 'Offer text',
};

function fakeLlm(...answers: string[]): LlmClient & { calls: number } {
  const llm = {
    calls: 0,
    async generateJson() {
      return answers[llm.calls++] ?? '';
    },
  };
  return llm;
}

describe('extractPageContent', () => {
  it('reads JSON-LD job data, the title and visible text only', () => {
    const html = `<html><head><title>Ignored &amp; title</title>
      <meta property="og:title" content="Frontend Dev &amp; AI">
      <script type="application/ld+json">{"@graph":[{"@type":"Organization"},
        {"@type":"JobPosting","title":"Frontend Dev","description":"&lt;p&gt;Build &lt;b&gt;UIs&lt;/b&gt;&lt;/p&gt;"}]}</script>
      </head><body><script>var secret = 1;</script>
      <h1>Frontend&nbsp;Dev</h1><p>React &amp; TypeScript</p></body></html>`;

    const content = extractPageContent(html);

    expect(content.title).toBe('Frontend Dev & AI');
    expect(JSON.parse(content.structuredData ?? '')).toMatchObject({
      title: 'Frontend Dev',
      description: 'Build UIs',
    });
    expect(content.text).toBe('Frontend Dev\nReact & TypeScript');
    expect(content.text).not.toContain('secret');
  });

  it('keeps the salary when the job data has huge extra fields', () => {
    const posting = {
      '@type': 'JobPosting',
      title: 'QA Engineer',
      hiringOrganization: { '@type': 'Organization', name: 'Acorn Labs' },
      applicantLocationRequirements: Array.from({ length: 500 }, (_, i) => ({
        '@type': 'Country',
        name: `Country ${i}`,
      })),
      description: 'Long description. '.repeat(1000),
      baseSalary: { currency: 'PLN', value: { value: 13000, unitText: 'Month' } },
    };
    const html = `<script type="application/ld+json">${JSON.stringify(posting)}</script>`;

    const structured = extractPageContent(html).structuredData ?? '';
    const parsed = JSON.parse(structured);

    expect(structured.length).toBeLessThanOrEqual(6000);
    expect(parsed).toMatchObject({
      baseSalary: { value: { value: 13000 } },
      hiringOrganization: 'Acorn Labs',
      title: 'QA Engineer',
    });
    expect(parsed).not.toHaveProperty('applicantLocationRequirements');
  });
});

describe('fetchJobPage', () => {
  it.each([
    'http://127.0.0.1:3000/applications',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://localhost:5432/',
  ])('refuses local address %s', async (url) => {
    await expect(fetchJobPage(url)).rejects.toThrow(
      'Links to local addresses are not allowed.',
    );
  });
});

describe('toOfferDraft', () => {
  it('converts hourly rates to monthly and keeps the original in notes', () => {
    const draft = toOfferDraft(
      { ...offer, salaryMin: 100, salaryMax: 120, salaryPeriod: 'HOUR', currency: 'zł' },
      page.url,
    );

    expect(draft).toMatchObject({
      salaryMin: 16800,
      salaryMax: 20160,
      currency: 'PLN',
      warning: null,
    });
    expect(draft.notes).toContain('Salary in offer: 100–120 PLN/h');
    expect(draft.notes).toContain('Work mode: Hybrid');
    expect(draft.notes).toContain('Tech: n8n, TypeScript');
  });

  it('swaps inverted salaries and drops a currency without salary', () => {
    expect(
      toOfferDraft({ ...offer, salaryMin: 9000, salaryMax: 7000 }, page.url),
    ).toMatchObject({ salaryMin: 7000, salaryMax: 9000 });
    expect(
      toOfferDraft({ ...offer, salaryMin: null, salaryMax: null }, page.url)
        .currency,
    ).toBeNull();
  });
});

describe('extractOffer', () => {
  it('asks the model again when the first answer is invalid', async () => {
    const llm = fakeLlm('not json', JSON.stringify(offer));

    const draft = await extractOffer(llm, page);

    expect(llm.calls).toBe(2);
    expect(draft.companyName).toBe('Acorn Labs');
  });

  it('gives up after two invalid answers', async () => {
    await expect(
      extractOffer(fakeLlm('{}', '{"jobTitle": 5}'), page),
    ).rejects.toBeInstanceOf(InvalidLlmOutputError);
  });

  it('rejects pages without a job title and warns about doubtful ones', async () => {
    await expect(
      extractOffer(fakeLlm(JSON.stringify({ ...offer, jobTitle: ' ' })), page),
    ).rejects.toBeInstanceOf(NotAJobOfferError);

    const draft = await extractOffer(
      fakeLlm(JSON.stringify({ ...offer, isJobOffer: false })),
      page,
    );
    expect(draft.warning).toMatch(/may not be a single job offer/);
  });
});

describe('POST /ai/parse-offer', () => {
  function appWith(llm: LlmClient, fetchPage = vi.fn(async () => page)) {
    return {
      app: createApp({} as PrismaClient, { llm, fetchPage }),
      fetchPage,
    };
  }

  it('returns a draft for the offer link', async () => {
    const { app, fetchPage } = appWith(fakeLlm(JSON.stringify(offer)));

    const response = await request(app)
      .post('/ai/parse-offer')
      .send({ url: page.url });

    expect(response.status).toBe(200);
    expect(fetchPage).toHaveBeenCalledWith(page.url);
    expect(response.body).toMatchObject({
      companyName: 'Acorn Labs',
      jobTitle: 'Junior AI Automation Developer',
      jobUrl: page.url,
      salaryMin: 8000,
    });
  });

  it('uses pasted text instead of downloading the page', async () => {
    const { app, fetchPage } = appWith(fakeLlm(JSON.stringify(offer)));

    const response = await request(app)
      .post('/ai/parse-offer')
      .send({ url: page.url, text: 'Offer text '.repeat(20) });

    expect(response.status).toBe(200);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('validates the link', async () => {
    const { app } = appWith(fakeLlm());

    const response = await request(app)
      .post('/ai/parse-offer')
      .send({ url: 'ftp://example.com/offer' });

    expect(response.status).toBe(400);
  });

  it('maps failures to clear error codes', async () => {
    const blocked = appWith(
      fakeLlm(),
      vi.fn(async () => {
        throw new PageFetchError('The website refused the request (HTTP 403).');
      }),
    );
    const offline: LlmClient = {
      generateJson: async () => {
        throw new LlmUnavailableError('Cannot reach Ollama.');
      },
    };

    const blockedResponse = await request(blocked.app)
      .post('/ai/parse-offer')
      .send({ url: page.url });
    const offlineResponse = await request(appWith(offline).app)
      .post('/ai/parse-offer')
      .send({ url: page.url });

    expect(blockedResponse.status).toBe(422);
    expect(blockedResponse.body.code).toBe('FETCH_FAILED');
    expect(offlineResponse.status).toBe(503);
    expect(offlineResponse.body.code).toBe('AI_UNAVAILABLE');
  });
});
