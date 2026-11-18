import { randomUUID } from 'node:crypto';
import type {
  ApplicationStatus,
  EmailCategory,
  EmailOutcome,
} from '../../generated/prisma/enums.js';

// Fictional applications for the demo user and the temporary "Try demo"
// accounts. They match the demo emails in n8n/demo-emails.md and the
// "Test with sample emails" trigger in the n8n workflow.

type DemoApplication = {
  key: string;
  companyName: string;
  jobTitle: string;
  status: ApplicationStatus;
  salaryMin?: number;
  salaryMax?: number;
  appliedDate?: string;
  notes?: string;
};

type DemoEmailEvent = {
  key: string;
  applicationKey: string;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  category: EmailCategory;
  companyName: string;
  jobTitle: string;
  confidence: number;
  reason: string;
  outcome: EmailOutcome;
  previousStatus: ApplicationStatus;
  newStatus: ApplicationStatus | null;
};

const DEMO_APPLICATIONS: DemoApplication[] = [
  // Demo email 1 moves this card from Applied to Interview.
  {
    key: 'acorn-labs',
    companyName: 'Acorn Labs',
    jobTitle: 'Junior AI Automation Developer',
    status: 'APPLIED',
    salaryMin: 9000,
    salaryMax: 12000,
    appliedDate: '2026-10-20',
    notes: 'Automation team, n8n and Python. Applied through the careers page.',
  },
  // Demo email 2 names the company but not the role, so it needs review.
  {
    key: 'harbor-frontend',
    companyName: 'Harbor Analytics',
    jobTitle: 'Frontend Developer',
    status: 'APPLIED',
    salaryMin: 12000,
    salaryMax: 15000,
    appliedDate: '2026-10-14',
  },
  {
    key: 'harbor-backend',
    companyName: 'Harbor Analytics',
    jobTitle: 'Backend Developer',
    status: 'APPLIED',
    salaryMin: 13000,
    salaryMax: 16000,
    appliedDate: '2026-10-14',
    notes: 'Applied to both roles on the same day.',
  },
  // Used by the n8n "Test with sample emails" trigger.
  {
    key: 'cedar-cloud',
    companyName: 'Cedar Cloud',
    jobTitle: 'Frontend Developer',
    status: 'APPLIED',
    salaryMin: 11000,
    salaryMax: 15000,
    appliedDate: '2026-10-08',
  },
  {
    key: 'birch-ai',
    companyName: 'Birch AI',
    jobTitle: 'Data Analyst',
    status: 'SAVED',
    notes: 'Apply this week.',
  },
  // The rest fills the board.
  {
    key: 'greenfield',
    companyName: 'Greenfield Tech',
    jobTitle: 'Software Engineer, Web',
    status: 'INTERVIEW_SCHEDULED',
    salaryMin: 16000,
    salaryMax: 21000,
    appliedDate: '2026-09-25',
    notes: 'Technical interview scheduled. Prepare project examples.',
  },
  {
    key: 'amber',
    companyName: 'Amber Digital',
    jobTitle: 'UI Engineer',
    status: 'OFFER',
    salaryMin: 18000,
    salaryMax: 22000,
    appliedDate: '2026-09-18',
  },
  {
    key: 'orbit',
    companyName: 'Orbit Works',
    jobTitle: 'Frontend Developer',
    status: 'REJECTED',
    appliedDate: '2026-09-10',
  },
  {
    key: 'northstar',
    companyName: 'Northstar Labs',
    jobTitle: 'Frontend Engineer',
    status: 'APPLIED',
    salaryMin: 14000,
    salaryMax: 18000,
    appliedDate: '2026-10-02',
    notes: 'Follow up after a week.',
  },
  {
    key: 'mosaic',
    companyName: 'Mosaic Systems',
    jobTitle: 'React Developer',
    status: 'SAVED',
    salaryMin: 12000,
    salaryMax: 16000,
  },
  {
    key: 'paperplane',
    companyName: 'Paperplane Studio',
    jobTitle: 'Junior Web Developer',
    status: 'SAVED',
    salaryMin: 9000,
    salaryMax: 12000,
  },
];

// Earlier emails, so "Email activity" already has history.
const DEMO_EMAIL_EVENTS: DemoEmailEvent[] = [
  {
    key: 'greenfield-interview',
    applicationKey: 'greenfield',
    fromAddress: 'Marta Zielińska <marta@greenfieldtech.example>',
    subject: 'Software Engineer, Web – zaproszenie na rozmowę techniczną',
    receivedAt: new Date('2026-10-06T09:12:00Z'),
    category: 'INTERVIEW_INVITATION',
    companyName: 'Greenfield Tech',
    jobTitle: 'Software Engineer, Web',
    confidence: 0.94,
    reason: 'The recruiter invites the candidate to a technical interview.',
    outcome: 'UPDATED',
    previousStatus: 'APPLIED',
    newStatus: 'INTERVIEW_SCHEDULED',
  },
  {
    key: 'orbit-received',
    applicationKey: 'orbit',
    fromAddress: 'Orbit Works Careers <careers@orbitworks.example>',
    subject: 'We received your application',
    receivedAt: new Date('2026-09-10T15:40:00Z'),
    category: 'APPLICATION_RECEIVED',
    companyName: 'Orbit Works',
    jobTitle: 'Frontend Developer',
    confidence: 0.97,
    reason: 'Automatic confirmation that the application was received.',
    outcome: 'NO_CHANGE',
    previousStatus: 'APPLIED',
    newStatus: null,
  },
  {
    key: 'orbit-rejection',
    applicationKey: 'orbit',
    fromAddress: 'Orbit Works Careers <careers@orbitworks.example>',
    subject: 'Update on your application',
    receivedAt: new Date('2026-09-24T08:05:00Z'),
    category: 'REJECTION',
    companyName: 'Orbit Works',
    jobTitle: 'Frontend Developer',
    confidence: 0.92,
    reason: 'The company decided to continue with other candidates.',
    outcome: 'UPDATED',
    previousStatus: 'APPLIED',
    newStatus: 'REJECTED',
  },
];

/**
 * A fresh copy of the demo data for one user, with new ids, ready for
 * `createMany`. Copies for different users never collide.
 *
 * @param {string} userId  Owner of the copied applications.
 * @returns {{ applications: object[]; emailEvents: object[] }}
 *   Rows for `jobApplication.createMany` and `emailEvent.createMany`.
 */
export function buildDemoData(userId: string) {
  const ids = new Map(
    DEMO_APPLICATIONS.map(({ key }) => [key, randomUUID()] as const),
  );
  const idOf = (key: string) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Unknown demo application "${key}".`);
    return id;
  };

  const applications = DEMO_APPLICATIONS.map(
    ({ key, appliedDate, ...application }) => ({
      ...application,
      id: idOf(key),
      userId,
      currency: 'PLN',
      appliedDate: appliedDate ? new Date(appliedDate) : null,
    }),
  );

  const emailEvents = DEMO_EMAIL_EVENTS.map(
    ({ key, applicationKey, ...event }) => ({
      ...event,
      // Unique across all copies, like a real Gmail message id.
      gmailMessageId: `demo-${key}-${randomUUID()}`,
      applicationId: idOf(applicationKey),
    }),
  );

  return { applications, emailEvents };
}
