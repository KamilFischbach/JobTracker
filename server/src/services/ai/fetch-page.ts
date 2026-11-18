import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch, type Response } from 'undici';

/**
 * A job offer page could not be downloaded or read. The message is safe to
 * show to the user.
 */
export class PageFetchError extends Error {}

// Raised from inside the connection's DNS lookup, so the request error
// handler can tell a blocked address from a network failure.
class BlockedAddressError extends Error {}

/**
 * Content of a downloaded job offer page, trimmed to what the LLM needs.
 */
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

const LOCAL_ADDRESS_MESSAGE = 'Links to local addresses are not allowed.';

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'pl,en;q=0.8',
};

/**
 * Tells whether an IP address is an ordinary public one. IPv4-mapped IPv6
 * in any notation (e.g. `::ffff:7f00:1`) is unwrapped first, and every
 * reserved range is refused: loopback, private, link-local (cloud metadata),
 * CGNAT, benchmarking, NAT64, 6to4, multicast, ...
 *
 * @param {string} address  IPv4 or IPv6 address, without brackets.
 * @returns {boolean}       `false` for reserved ranges and invalid input.
 */
export function isPublicAddress(address: string) {
  if (!ipaddr.isValid(address)) return false;
  return ipaddr.process(address).range() === 'unicast';
}

// The server fetches URLs typed by the user, so it refuses addresses inside
// the local network (localhost, router, cloud metadata endpoints, ...).
// Host names are checked in pinnedLookup, at connection time; IP literals
// skip DNS, so they are checked here.
function assertAllowedUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PageFetchError('Only http and https links are supported.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new PageFetchError(LOCAL_ADDRESS_MESSAGE);
  }
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new PageFetchError(LOCAL_ADDRESS_MESSAGE);
  }
}

// DNS lookup used by the socket itself. The addresses it checks are the ones
// the connection uses, so a domain cannot pass a check with a public IP and
// then resolve to 127.0.0.1 for the download (DNS rebinding).
const pinnedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '');

    const list = addresses as LookupAddress[];
    const first = list[0];
    if (!first || list.some(({ address }) => !isPublicAddress(address))) {
      return callback(new BlockedAddressError(LOCAL_ADDRESS_MESSAGE), '');
    }

    if (options.all) return callback(null, list);
    return callback(null, first.address, first.family);
  });
};

// Node's built-in fetch cannot take a custom DNS lookup; undici's Agent can.
const dispatcher = new Agent({ connect: { lookup: pinnedLookup } });

function findCause<T>(
  error: unknown,
  match: (cause: unknown) => cause is T,
): T | undefined {
  for (let current = error; current; current = (current as Error).cause) {
    if (match(current)) return current;
    if (typeof current !== 'object') break;
  }
  return undefined;
}

function toPageFetchError(error: unknown, url: URL, signal: AbortSignal) {
  if (findCause(error, (e) => e instanceof BlockedAddressError)) {
    return new PageFetchError(LOCAL_ADDRESS_MESSAGE);
  }
  const dnsFailure = findCause(
    error,
    (e): e is NodeJS.ErrnoException =>
      e instanceof Error &&
      ['ENOTFOUND', 'EAI_AGAIN', 'ENODATA'].includes(
        (e as NodeJS.ErrnoException).code ?? '',
      ),
  );
  if (dnsFailure) {
    return new PageFetchError(`Could not find the website ${url.hostname}.`);
  }
  return new PageFetchError(
    signal.aborted
      ? 'The website took too long to respond.'
      : 'Could not connect to the website.',
  );
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

/**
 * Downloads a job offer page and extracts its title, JSON-LD and text.
 * Follows redirects, and refuses links that lead to local or private network
 * addresses, also when a host name resolves to one.
 *
 * @param {string} rawUrl       Link typed by the user.
 * @returns {Promise<JobPage>}  The page content, ready for the LLM.
 * @throws {PageFetchError}     When the page cannot be downloaded or read.
 */
export async function fetchJobPage(rawUrl: string): Promise<JobPage> {
  let url = new URL(rawUrl);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    assertAllowedUrl(url);

    let response: Response;
    try {
      response = await fetch(url, {
        dispatcher,
        redirect: 'manual',
        signal,
        headers: REQUEST_HEADERS,
      });
    } catch (error) {
      throw toPageFetchError(error, url, signal);
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      // Release the connection before following the redirect.
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new PageFetchError(
        `The website refused the request (HTTP ${response.status}).`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !/html|text\/plain/i.test(contentType)) {
      await response.body?.cancel();
      throw new PageFetchError('The link does not point to a web page.');
    }

    let html: string;
    try {
      html = await readLimitedBody(response);
    } catch (error) {
      throw toPageFetchError(error, url, signal);
    }

    const page = extractPageContent(html);
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

/**
 * Pulls the parts the LLM needs out of raw HTML: the page title, the
 * JSON-LD `JobPosting` (if any) and the visible text, each length-limited.
 *
 * @param {string} html  Raw page HTML.
 * @returns {Omit<JobPage, 'url'>}  Title, structured data and text.
 */
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
