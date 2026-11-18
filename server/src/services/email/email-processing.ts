import type { PrismaClient } from '../../generated/prisma/client.js';
import type {
  ApplicationStatus,
  EmailOutcome,
} from '../../generated/prisma/enums.js';
import type { ClassifiedEmail } from '../../schemas/email.js';
import {
  CONFIDENCE_THRESHOLD,
  matchApplication,
  nextStatus,
} from './email-status.js';

type Decision = {
  outcome: EmailOutcome;
  applicationId: string | null;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus | null;
};

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

async function decide(
  prisma: PrismaClient,
  email: ClassifiedEmail,
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

// decide() read the status before the transaction, so the user may have moved
// the card since. The update only applies if the status is still the one the
// decision was based on; otherwise the email is left for review.
async function applyDecision(
  tx: Transaction,
  decision: Decision,
): Promise<Decision> {
  const { applicationId, previousStatus, newStatus } = decision;
  if (!applicationId || !previousStatus || !newStatus) return decision;

  const { count } = await tx.jobApplication.updateMany({
    where: { id: applicationId, status: previousStatus },
    data: { status: newStatus },
  });
  if (count === 1) return decision;

  const current = await tx.jobApplication.findUnique({
    where: { id: applicationId },
    select: { status: true },
  });
  if (!current) {
    // Deleted in the meantime: nothing left to link the email to.
    return {
      outcome: 'NO_MATCH',
      applicationId: null,
      previousStatus: null,
      newStatus: null,
    };
  }
  return {
    outcome: 'NEEDS_REVIEW',
    applicationId,
    previousStatus: current.status,
    newStatus: null,
  };
}

/**
 * Creates the service that applies classified recruiter emails to the board.
 *
 * @param {PrismaClient} prisma  Database client.
 * @returns {EmailProcessingService}  The service.
 */
export function createEmailProcessingService(prisma: PrismaClient) {
  return {
    /**
     * Matches the email to an application, moves its status forward when the
     * rules allow it, and logs the email as an `EmailEvent`. Each Gmail
     * message is processed once; repeats return the existing event.
     *
     * @param {ClassifiedEmail} email  The email as classified by n8n.
     * @returns {Promise<{ duplicate: boolean; event: EmailEvent | null }>}
     *   `duplicate` is true when the message was processed before.
     */
    async processEmail(email: ClassifiedEmail) {
      // n8n may retry or re-read an email: process each message only once.
      const existing = await prisma.emailEvent.findUnique({
        where: { gmailMessageId: email.messageId },
      });
      if (existing) return { duplicate: true, event: existing };

      const decision = await decide(prisma, email);

      try {
        const event = await prisma.$transaction(async (tx) => {
          const applied = await applyDecision(tx, decision);
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
              ...applied,
            },
          });
        });
        return { duplicate: false, event };
      } catch (error) {
        // Two deliveries of the same email at once: the second one loses.
        if (!isUniqueViolation(error)) throw error;
        const event = await prisma.emailEvent.findUnique({
          where: { gmailMessageId: email.messageId },
        });
        return { duplicate: true, event };
      }
    },
  };
}

/**
 * The service created by {@link createEmailProcessingService}.
 */
export type EmailProcessingService = ReturnType<
  typeof createEmailProcessingService
>;
