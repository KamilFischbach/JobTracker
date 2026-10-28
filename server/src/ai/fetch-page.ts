import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class PageFetchError extends Error {}

export type JobPage = {
  url: string;
  title: string | null;
  // JobPosting data from JSON-LD, which many job boards embed for Google Jobs.
  structuredData: string | null;
  text: string;
};

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 3_000_000;
const MAX_TEXT_LENGTH = 12_000;
const MAX_STRUCTURED_LENGTH = 6_000;

function isPrivateIPv4(address: string) {
  const [a = 0, b = 0] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return isPrivateIPv4(address);

  const normalized = address.toLowerCase();
  const mappedIPv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIPv4) return isPrivateIPv4(mappedIPv4);

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  );
}

// The server fetches URLs typed by the user, so it refuses addresses inside
// the local network (localhost, router, cloud metadata endpoints, ...).
async function assertPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PageFetchError('Only http and https links are supported.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new PageFetchError('Links to local addresses are not allowed.');
  }

  let addresses: { address: string }[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true });
  } catch {
    throw new PageFetchError(`Could not find the website ${url.hostname}.`);
  }

  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new PageFetchError('Links to local addresses are not allowed.');
  }
}

async function readLimitedBody(response: Response) {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchJobPage(rawUrl: string): Promise<JobPage> {
  let url = new URL(rawUrl);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    await assertPublicUrl(url);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pl,en;q=0.8',
        },
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new PageFetchError(
        timedOut
          ? 'The website took too long to respond.'
          : 'Could not connect to the website.',
      );
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }

    if (!response.ok) {
      throw new PageFetchError(
        `The website refused the request (HTTP ${response.status}).`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !/html|text\/plain/i.test(contentType)) {
      throw new PageFetchError('The link does not point to a web page.');
    }

    const page = extractPageContent(await readLimitedBody(response));
    if (!page.structuredData && page.text.length < 200) {
      throw new PageFetchError(
        'The page has too little text to read an offer from. If it loads the offer with JavaScript, paste the offer text instead.',
      );
    }

    return { url: url.toString(), ...page };
  }

  throw new PageFetchError('The link redirects too many times.');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string) {
  const text = html
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes('JobPosting')) return record;

  return findJobPosting(record['@graph']);
}

// Fields the model needs, salary first. Job boards add huge extras (e.g. a
// list of every country) that would push the salary past the length limit.
const JOB_POSTING_FIELDS = [
  'baseSalary',
  'estimatedSalary',
  'title',
  'hiringOrganization',
  'employmentType',
  'jobLocationType',
  'jobLocation',
  'experienceRequirements',
  'skills',
  'description',
];

function summarizeJobPosting(posting: Record<string, unknown>) {
  const summary: Record<string, unknown> = {};
  for (const field of JOB_POSTING_FIELDS) {
    const value = posting[field];
    if (value == null) continue;
    summary[field] =
      field === 'description' && typeof value === 'string'
        ? htmlToText(decodeEntities(value))
        : field === 'hiringOrganization' && typeof value === 'object'
          ? (value as Record<string, unknown>).name
          : value;
  }

  // Cut the description, not the JSON, so the result stays valid JSON.
  const json = JSON.stringify(summary);
  if (json.length <= MAX_STRUCTURED_LENGTH || typeof summary.description !== 'string') {
    return json.slice(0, MAX_STRUCTURED_LENGTH);
  }
  const overflow = json.length - MAX_STRUCTURED_LENGTH;
  summary.description = `${summary.description.slice(0, Math.max(0, summary.description.length - overflow - 3))}...`;
  return JSON.stringify(summary);
}

function extractStructuredData(html: string) {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const [, content = ''] of scripts) {
    try {
      const posting = findJobPosting(JSON.parse(content));
      if (!posting) continue;

      return summarizeJobPosting(posting);
    } catch {
      // Broken JSON-LD is common; the page text is still used.
    }
  }

  return null;
}

export function extractPageContent(html: string) {
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
  )?.[1];
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = decodeEntities(ogTitle ?? titleTag ?? '').trim() || null;

  return {
    title,
    structuredData: extractStructuredData(html),
    text: htmlToText(html).slice(0, MAX_TEXT_LENGTH),
  };
}
