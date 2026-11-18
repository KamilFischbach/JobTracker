import type { ParseOfferRequest } from '../../schemas/offer.js';
import type { AuthUser } from '../auth/session-service.js';
import type { AiUsageService } from './ai-usage.js';
import type { JobPage } from './fetch-page.js';
import { type LlmClient, LlmUnavailableError } from './llm.js';
import { extractOffer, type OfferDraft } from './parse-offer.js';

/**
 * What the offer import needs from the outside world. Tests pass fakes.
 */
export type OfferImportDependencies = {
  llm: LlmClient;
  fetchPage: (url: string) => Promise<JobPage>;
  /** Cap on the offer text sent to the model (provider token budget). */
  maxInputChars?: number | undefined;
};

/**
 * Creates the service behind "Fill with AI": reads a job offer and returns a
 * draft for the add application form. Nothing is saved.
 *
 * @param {OfferImportDependencies} dependencies  LLM client and page fetcher.
 * @param {AiUsageService}          usage         Daily limits.
 * @returns {OfferImportService}                  The service.
 */
export function createOfferImportService(
  { llm, fetchPage, maxInputChars }: OfferImportDependencies,
  usage: AiUsageService,
) {
  return {
    /**
     * Reads the offer from the pasted text if given, otherwise downloads the
     * page, and extracts the form fields with the LLM. Only calls that reach
     * the LLM count toward the daily limit; an unreachable provider does not.
     *
     * @param {ParseOfferRequest}  request  Offer link and optional pasted text.
     * @param {AuthUser}           user     Logged-in user.
     * @param {string | undefined} ip       Client address, for demo limits.
     * @returns {Promise<OfferDraft>}       Data to prefill the form with.
     * @throws {PageFetchError | AiLimitReachedError | NotAJobOfferError | LlmUnavailableError | InvalidLlmOutputError}
     */
    async importOffer(
      { url, text }: ParseOfferRequest,
      user: AuthUser,
      ip: string | undefined,
    ): Promise<OfferDraft> {
      const page: JobPage = text
        ? { url, title: null, structuredData: null, text }
        : await fetchPage(url);

      const release = await usage.reserve(user, ip);
      try {
        return await extractOffer(llm, page, maxInputChars);
      } catch (error) {
        if (error instanceof LlmUnavailableError) await release();
        throw error;
      }
    },

    /**
     * Used and allowed AI imports of the user today.
     *
     * @param {AuthUser}           user  Logged-in user.
     * @param {string | undefined} ip    Client address.
     * @returns {Promise<{ used: number; limit: number }>}
     */
    getUsage(user: AuthUser, ip: string | undefined) {
      return usage.getUsage(user, ip);
    },
  };
}

/**
 * The offer import service created by {@link createOfferImportService}.
 */
export type OfferImportService = ReturnType<typeof createOfferImportService>;
