import { z } from 'zod';
import type { JobPage } from './fetch-page.js';
import type { ChatMessage, LlmClient } from './llm.js';

export class NotAJobOfferError extends Error {}
export class InvalidLlmOutputError extends Error {}

// What the model must return. Ollama receives it as a JSON schema, and the
// same schema validates the answer afterwards.
export const extractedOfferSchema = z.object({
  companyName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  currency: z.string().nullable(),
  salaryPeriod: z.enum(['HOUR', 'DAY', 'MONTH', 'YEAR']).nullable(),
  contractType: z.string().nullable(),
  location: z.string().nullable(),
  workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']).nullable(),
  technologies: z.array(z.string()),
  summary: z.string().nullable(),
  // Last on purpose: the model decides after reading the other fields.
  isJobOffer: z.boolean(),
});

export type ExtractedOffer = z.infer<typeof extractedOfferSchema>;

export type OfferDraft = {
  companyName: string | null;
  jobTitle: string | null;
  jobUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  notes: string | null;
  // Shown in the form when the model doubts the page is a single offer.
  warning: string | null;
};

const offerJsonSchema = z.toJSONSchema(extractedOfferSchema);

const SYSTEM_PROMPT = `You extract data from job offers for a job application tracker.
Rules:
- Use only facts stated in the offer. If something is not stated, return null. Never guess.
- isJobOffer: true for any single position people can apply to (including internships, fellowships, contracts).
  false only if the page is clearly something else (e.g. a login page, a list of many offers, an error page).
- companyName: the hiring employer, not the job board (not LinkedIn, Pracuj.pl, Just Join IT, No Fluff Jobs, etc.).
- jobTitle: the position name without company or location.
- Salary: copy numbers exactly as written, gross. "15k" means 15000. If only one amount is given, use it for both salaryMin and salaryMax.
  If several contract types have different salaries, use the first one listed and name it in contractType.
  Structured data often holds only the top of the range: if the page text shows a range (e.g. "9 000 – 13 000 PLN"), use the range from the text.
  Ignore salary calculators and "check if the salary suits you" widgets (e.g. "> 4 000 PLN"); they are not the offer's salary.
- salaryPeriod: the period the salary is stated for (HOUR, DAY, MONTH, YEAR). Do not convert the amounts.
- currency: ISO 4217 code, e.g. PLN, EUR, USD. "zł" is PLN.
- technologies: up to 8 languages, frameworks or tools the candidate is expected to know. Not equipment or benefits (e.g. not "MacBook").
- summary: 1-2 short sentences in English about the role and its key requirements.`;

const PERIOD_TO_MONTHLY = { HOUR: 168, DAY: 21, MONTH: 1, YEAR: 1 / 12 };
const PERIOD_LABEL = { HOUR: 'h', DAY: 'day', MONTH: 'month', YEAR: 'year' };
const MAX_ATTEMPTS = 2;

function buildPageMessage(page: JobPage) {
  return [
    `URL: ${page.url}`,
    page.title ? `Page title: ${page.title}` : null,
    page.structuredData
      ? `Structured data (JSON-LD JobPosting):\n${page.structuredData}`
      : null,
    `Page text:\n${page.text}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function cleanText(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCurrency(value: string | null) {
  const code = value?.trim().toUpperCase();
  if (!code) return null;
  if (code === 'ZŁ' || code === 'ZL' || code === 'PLZ') return 'PLN';
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

// The tracker stores monthly salaries. Unit conversion is done here in code,
// because small models are unreliable at arithmetic.
export function toOfferDraft(offer: ExtractedOffer, url: string): OfferDraft {
  const period = offer.salaryPeriod ?? 'MONTH';
  const toMonthly = (value: number | null) =>
    value && value > 0 ? Math.round(value * PERIOD_TO_MONTHLY[period]) : null;

  let salaryMin = toMonthly(offer.salaryMin);
  let salaryMax = toMonthly(offer.salaryMax);
  if (salaryMin && salaryMax && salaryMin > salaryMax) {
    [salaryMin, salaryMax] = [salaryMax, salaryMin];
  }
  const currency = normalizeCurrency(offer.currency);

  const workMode = offer.workMode
    ? offer.workMode.charAt(0) + offer.workMode.slice(1).toLowerCase()
    : null;
  const originalAmounts = [
    ...new Set([offer.salaryMin, offer.salaryMax].filter(Boolean)),
  ];
  const originalSalary =
    period !== 'MONTH' && originalAmounts.length
      ? `${originalAmounts.join('–')} ${currency ?? ''}`.trim() +
        `/${PERIOD_LABEL[period]} (converted to monthly)`
      : null;

  const notes = [
    cleanText(offer.summary),
    offer.location ? `Location: ${offer.location.trim()}` : null,
    workMode ? `Work mode: ${workMode}` : null,
    offer.contractType ? `Contract: ${offer.contractType.trim()}` : null,
    offer.technologies.length
      ? `Tech: ${offer.technologies.map((tech) => tech.trim()).join(', ')}`
      : null,
    originalSalary ? `Salary in offer: ${originalSalary}` : null,
  ].filter(Boolean);

  return {
    companyName: cleanText(offer.companyName),
    jobTitle: cleanText(offer.jobTitle),
    jobUrl: url,
    salaryMin,
    salaryMax,
    currency: salaryMin || salaryMax ? currency : null,
    notes: notes.length ? notes.join('\n') : null,
    warning: offer.isJobOffer
      ? null
      : 'This page may not be a single job offer. Check the data before saving.',
  };
}

export async function extractOffer(
  llm: LlmClient,
  page: JobPage,
): Promise<OfferDraft> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildPageMessage(page) },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const answer = await llm.generateJson({
      messages,
      schema: offerJsonSchema,
    });

    let problem: string;
    try {
      const parsed = extractedOfferSchema.safeParse(JSON.parse(answer));
      if (parsed.success) {
        const offer = parsed.data;
        // Without a job title the form cannot be saved anyway. Doubtful
        // pages still return data, with a warning for the user to check.
        if (!cleanText(offer.jobTitle)) {
          throw new NotAJobOfferError(
            'This page does not look like a single job offer.',
          );
        }
        return toOfferDraft(offer, page.url);
      }
      problem = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
    } catch (error) {
      if (error instanceof NotAJobOfferError) throw error;
      problem = 'The answer was not valid JSON.';
    }

    // Give the model its mistake and ask again.
    messages.push(
      { role: 'assistant', content: answer },
      {
        role: 'user',
        content: `Your answer did not match the required format: ${problem}. Answer again with valid JSON only.`,
      },
    );
  }

  throw new InvalidLlmOutputError(
    'The AI model returned data in a wrong format. Try again.',
  );
}
