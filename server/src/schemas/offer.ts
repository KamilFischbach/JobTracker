import { z } from 'zod';

/**
 * Body of `POST /ai/parse-offer`.
 */
export const parseOfferRequestSchema = z.object({
  url: z.url({ protocol: /^https?$/, message: 'Enter a valid http(s) link.' }),
  // Fallback for sites that block automatic downloads: the user pastes the text.
  text: z
    .string()
    .trim()
    .min(100, 'Paste the full offer text.')
    .max(50_000)
    .optional(),
});

/**
 * Validated body of `POST /ai/parse-offer`.
 */
export type ParseOfferRequest = z.output<typeof parseOfferRequestSchema>;
