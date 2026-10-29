import { createHash, timingSafeEqual } from 'node:crypto';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import {
  CONFIDENCE_THRESHOLD,
  matchApplication,
  nextStatus,
} from '../email/email-status.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type {
  ApplicationStatus,
  EmailOutcome,
} from '../generated/prisma/enums.js';

// Hashing first gives equal-length buffers, which timingSafeEqual needs.
function sameSecret(a: string, b: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function requireApiKey(apiKey: string | undefined): RequestHandler {
  return (request, response, next) => {
    if (!apiKey) {
      return response
        .status(503)
        .json({ message: 'Webhooks are disabled. Set WEBHOOK_API_KEY.' });
    }
    const sent = request.get('x-api-key');
    if (!sent || !sameSecret(sent, apiKey)) {
      return response.status(401).json({ message: 'Invalid API key.' });
    }
    return next();
  };
}

const emailStatusSchema = z.object({
  messageId: z.string().trim().min(1).max(255),
  from: z.string().trim().max(320),
  subject: z.string().max(998).default(''),
  receivedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
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

type Decision = {
  outcome: EmailOutcome;
  applicationId: string | null;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus | null;
};

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export function createWebhooksRouter(
  prisma: PrismaClient,
  apiKey: string | undefined,
): Router {
  const router: Router = Router();
  router.use(requireApiKey(apiKey));

  // Called by the n8n workflow after the LLM has classified an email.
  router.post('/email-status', async (request, response) => {
    const parsed = emailStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        message: parsed.error.issues[0]?.message ?? 'Invalid input.',
        errors: parsed.error.issues,
      });
    }
    const email = parsed.data;

    // n8n may retry or re-read an email: process each message only once.
    const existing = await prisma.emailEvent.findUnique({
      where: { gmailMessageId: email.messageId },
    });
    if (existing) return response.json({ duplicate: true, event: existing });

    const decision = await decide(prisma, email);

    try {
      const event = await prisma.$transaction(async (tx) => {
        if (decision.applicationId && decision.newStatus) {
          await tx.jobApplication.update({
            where: { id: decision.applicationId },
            data: { status: decision.newStatus },
          });
        }
        return tx.emailEvent.create({
          data: {
            gmailMessageId: email.messageId,
            fromAddress: email.from,
            subject: email.subject,
            receivedAt: email.receivedAt,
            category: email.category,
            companyName: email.companyName,
            jobTitle: email.jobTitle,
            confidence: email.confidence,
            reason: email.reason,
            ...decision,
          },
        });
      });
      return response.status(201).json({ duplicate: false, event });
    } catch (error) {
      // Two deliveries of the same email at once: the second one loses.
      if (isUniqueViolation(error)) {
        const event = await prisma.emailEvent.findUnique({
          where: { gmailMessageId: email.messageId },
        });
        return response.json({ duplicate: true, event });
      }
      throw error;
    }
  });

  return router;
}

async function decide(
  prisma: PrismaClient,
  email: z.infer<typeof emailStatusSchema>,
): Promise<Decision> {
  const none = { applicationId: null, previousStatus: null, newStatus: null };

  if (email.category === 'NOT_JOB_RELATED') {
    return { outcome: 'IGNORED', ...none };
  }

  const applications = await prisma.jobApplication.findMany({
    select: { id: true, companyName: true, jobTitle: true, status: true },
  });
  const match = matchApplication(applications, email);
  if (match.kind === 'none') return { outcome: 'NO_MATCH', ...none };
  if (match.kind === 'ambiguous') return { outcome: 'NEEDS_REVIEW', ...none };

  const { application } = match;
  const linked = {
    applicationId: application.id,
    previousStatus: application.status,
  };

  if (email.confidence < CONFIDENCE_THRESHOLD) {
    return { outcome: 'NEEDS_REVIEW', ...linked, newStatus: null };
  }

  const status = nextStatus(email.category, application.status);
  return status
    ? { outcome: 'UPDATED', ...linked, newStatus: status }
    : { outcome: 'NO_CHANGE', ...linked, newStatus: null };
}
