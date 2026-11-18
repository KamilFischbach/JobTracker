import type { ParseOfferRequest } from '../../schemas/offer.js';
import type { JobPage } from './fetch-page.js';
import type { LlmClient } from './llm.js';
import { extractOffer, type OfferDraft } from './parse-offer.js';

/**
 * What the offer import needs from the outside world. Tests pass fakes.
 */
export type OfferImportDependencies = {
  llm: LlmClient;
  fetchPage: (url: string) => Promise<JobPage>;
};

/**
 * Creates the service behind "Fill with AI": reads a job offer and returns a
 * draft for the add application form. Nothing is saved.
 *
 * @param {OfferImportDependencies} dependencies  LLM client and page fetcher.
 * @returns {OfferImportService}                  The service.
 */
export function createOfferImportService({
  llm,
  fetchPage,
}: OfferImportDependencies) {
  return {
    /**
     * Reads the offer from the pasted text if given, otherwise downloads the
     * page, and extracts the form fields with the LLM.
     *
     * @param {ParseOfferRequest} request  Offer link and optional pasted text.
     * @returns {Promise<OfferDraft>}      Data to prefill the form with.
     * @throws {PageFetchError | NotAJobOfferError | LlmUnavailableError | InvalidLlmOutputError}
     */
    async importOffer({ url, text }: ParseOfferRequest): Promise<OfferDraft> {
      const page: JobPage = text
        ? { url, title: null, structuredData: null, text }
        : await fetchPage(url);

      return extractOffer(llm, page);
    },
  };
}

/**
 * The offer import service created by {@link createOfferImportService}.
 */
export type OfferImportService = ReturnType<typeof createOfferImportService>;
