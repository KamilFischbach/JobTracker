import type { ApplicationStatus } from './ApplicationStatus';

export type EmailCategory =
  | 'APPLICATION_RECEIVED'
  | 'INTERVIEW_INVITATION'
  | 'REJECTION'
  | 'OFFER'
  | 'NOT_JOB_RELATED';

export type EmailOutcome =
  | 'UPDATED'
  | 'NO_CHANGE'
  | 'NEEDS_REVIEW'
  | 'NO_MATCH'
  | 'IGNORED';

// An email the n8n workflow classified and linked to an application.
export type EmailEvent = {
  id: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  category: EmailCategory;
  confidence: number;
  reason: string | null;
  outcome: EmailOutcome;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus | null;
};
