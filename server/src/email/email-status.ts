import type {
  ApplicationStatus,
  EmailCategory,
} from '../generated/prisma/enums.js';

// Below this the email is logged for review, never applied automatically.
export const CONFIDENCE_THRESHOLD = 0.7;

// Which status each kind of email moves an application to, and from where.
// Anything else (e.g. a late "application received" after an interview)
// leaves the status alone, so the board never moves backwards.
const TRANSITIONS: Record<
  Exclude<EmailCategory, 'NOT_JOB_RELATED'>,
  { to: ApplicationStatus; from: ApplicationStatus[] }
> = {
  APPLICATION_RECEIVED: { to: 'APPLIED', from: ['SAVED'] },
  INTERVIEW_INVITATION: {
    to: 'INTERVIEW_SCHEDULED',
    from: ['SAVED', 'APPLIED'],
  },
  REJECTION: {
    to: 'REJECTED',
    from: ['SAVED', 'APPLIED', 'INTERVIEW_SCHEDULED'],
  },
  OFFER: { to: 'OFFER', from: ['SAVED', 'APPLIED', 'INTERVIEW_SCHEDULED'] },
};

export function nextStatus(
  category: EmailCategory,
  current: ApplicationStatus,
): ApplicationStatus | null {
  if (category === 'NOT_JOB_RELATED') return null;
  const rule = TRANSITIONS[category];
  return rule.from.includes(current) ? rule.to : null;
}

// Words that say nothing about which company it is.
const LEGAL_WORDS = new Set([
  'sp', 'zoo', 'oo', 'sa', 'spolka', 'ograniczona', 'odpowiedzialnoscia',
  'akcyjna', 'oddzial', 'polsce', 'inc', 'ltd', 'llc', 'gmbh', 'ag', 'bv',
  'corp', 'corporation', 'plc', 'co', 'the',
]);

function words(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
}

export function companyWords(name: string) {
  return words(name).filter((word) => !LEGAL_WORDS.has(word));
}

// "Box" matches "Box Inc.", "Motorola Solutions" matches
// "Motorola Solutions Systems Polska": all words of the shorter name appear
// in the longer one.
export function isSameCompany(a: string, b: string) {
  const first = companyWords(a);
  const second = companyWords(b);
  if (!first.length || !second.length) return false;
  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];
  const longerSet = new Set(longer);
  return shorter.every((word) => longerSet.has(word));
}

export function titleSimilarity(a: string, b: string) {
  const first = new Set(words(a));
  const second = new Set(words(b));
  if (!first.size || !second.size) return 0;
  const shared = [...first].filter((word) => second.has(word)).length;
  return shared / new Set([...first, ...second]).size;
}

type Candidate = {
  id: string;
  companyName: string;
  jobTitle: string;
  status: ApplicationStatus;
};

export type MatchResult<T> =
  | { kind: 'match'; application: T }
  | { kind: 'ambiguous'; applications: T[] }
  | { kind: 'none' };

const CLOSED: ApplicationStatus[] = ['REJECTED', 'OFFER'];
const MIN_TITLE_SIMILARITY = 0.3;

export function matchApplication<T extends Candidate>(
  applications: T[],
  email: { companyName: string | null; jobTitle: string | null },
): MatchResult<T> {
  if (!email.companyName) return { kind: 'none' };

  let matches = applications.filter((application) =>
    isSameCompany(application.companyName, email.companyName ?? ''),
  );
  if (matches.length === 0) return { kind: 'none' };

  // Prefer applications that are still in progress.
  const open = matches.filter((app) => !CLOSED.includes(app.status));
  if (matches.length > 1 && open.length > 0) matches = open;
  if (matches.length === 1) return { kind: 'match', application: matches[0]! };

  // Several roles at the same company: the job title has to decide.
  if (email.jobTitle) {
    const scored = matches
      .map((application) => ({
        application,
        score: titleSimilarity(application.jobTitle, email.jobTitle ?? ''),
      }))
      .sort((a, b) => b.score - a.score);
    const [best, second] = scored;
    if (
      best &&
      best.score >= MIN_TITLE_SIMILARITY &&
      best.score > (second?.score ?? 0)
    ) {
      return { kind: 'match', application: best.application };
    }
  }

  return { kind: 'ambiguous', applications: matches };
}
