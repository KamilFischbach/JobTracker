import { z } from 'zod';

/**
 * Body of `POST /webhooks/email-status`: an email the n8n workflow has
 * classified with the LLM.
 */
export const emailStatusSchema = z.object({
  messageId: z.string().trim().min(1).max(255),
  from: z.string().trim().max(320),
  subject: z.string().max(998).default(''),
  receivedAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value)),
  category: z.enum([
    'APPLICATION_RECEIVED',
    'INTERVIEW_INVITATION',
    'REJECTION',
    'OFFER',
    'NOT_JOB_RELATED',
  ]),
  companyName: z.string().trim().max(200).nullish().transform((v) => v || null),
  jobTitle: z.string().trim().max(200).nullish().transform((v) => v || null),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().max(1000).nullish().transform((v) => v || null),
});

/**
 * Validated body of `POST /webhooks/email-status`.
 */
export type ClassifiedEmail = z.output<typeof emailStatusSchema>;
