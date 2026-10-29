// Fills the local database with fictional applications for demos and videos.
//
//   pnpm --filter server db:seed         only runs on an empty database
//   pnpm --filter server db:seed:reset   deletes ALL applications and emails first
//
// The data matches the demo emails in n8n/demo-emails.md and the
// "Test with sample emails" trigger in the n8n workflow.
import { prisma } from '../src/prisma.js';
import type { ApplicationStatus } from '../src/generated/prisma/enums.js';

type SeedApplication = {
  id: string;
  companyName: string;
  jobTitle: string;
  status: ApplicationStatus;
  salaryMin?: number;
  salaryMax?: number;
  appliedDate?: string;
  notes?: string;
};

const applications: SeedApplication[] = [
  // Demo email 1 moves this card from Applied to Interview.
  {
    id: 'seed-acorn-labs',
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
    id: 'seed-harbor-frontend',
    companyName: 'Harbor Analytics',
    jobTitle: 'Frontend Developer',
    status: 'APPLIED',
    salaryMin: 12000,
    salaryMax: 15000,
    appliedDate: '2026-10-14',
  },
  {
    id: 'seed-harbor-backend',
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
    id: 'seed-cedar-cloud',
    companyName: 'Cedar Cloud',
    jobTitle: 'Frontend Developer',
    status: 'APPLIED',
    salaryMin: 11000,
    salaryMax: 15000,
    appliedDate: '2026-10-08',
  },
  {
    id: 'seed-birch-ai',
    companyName: 'Birch AI',
    jobTitle: 'Data Analyst',
    status: 'SAVED',
    notes: 'Apply this week.',
  },
  // The rest fills the board.
  {
    id: 'seed-greenfield',
    companyName: 'Greenfield Tech',
    jobTitle: 'Software Engineer, Web',
    status: 'INTERVIEW_SCHEDULED',
    salaryMin: 16000,
    salaryMax: 21000,
    appliedDate: '2026-09-25',
    notes: 'Technical interview scheduled. Prepare project examples.',
  },
  {
    id: 'seed-amber',
    companyName: 'Amber Digital',
    jobTitle: 'UI Engineer',
    status: 'OFFER',
    salaryMin: 18000,
    salaryMax: 22000,
    appliedDate: '2026-09-18',
  },
  {
    id: 'seed-orbit',
    companyName: 'Orbit Works',
    jobTitle: 'Frontend Developer',
    status: 'REJECTED',
    appliedDate: '2026-09-10',
  },
  {
    id: 'seed-northstar',
    companyName: 'Northstar Labs',
    jobTitle: 'Frontend Engineer',
    status: 'APPLIED',
    salaryMin: 14000,
    salaryMax: 18000,
    appliedDate: '2026-10-02',
    notes: 'Follow up after a week.',
  },
  {
    id: 'seed-mosaic',
    companyName: 'Mosaic Systems',
    jobTitle: 'React Developer',
    status: 'SAVED',
    salaryMin: 12000,
    salaryMax: 16000,
  },
  {
    id: 'seed-paperplane',
    companyName: 'Paperplane Studio',
    jobTitle: 'Junior Web Developer',
    status: 'SAVED',
    salaryMin: 9000,
    salaryMax: 12000,
  },
];

// Earlier emails, so "Email activity" already has history in the video.
const emailEvents = [
  {
    gmailMessageId: 'seed-greenfield-interview',
    applicationId: 'seed-greenfield',
    fromAddress: 'Marta Zielińska <marta@greenfieldtech.example>',
    subject: 'Software Engineer, Web – zaproszenie na rozmowę techniczną',
    receivedAt: new Date('2026-10-06T09:12:00Z'),
    category: 'INTERVIEW_INVITATION' as const,
    companyName: 'Greenfield Tech',
    jobTitle: 'Software Engineer, Web',
    confidence: 0.94,
    reason: 'The recruiter invites the candidate to a technical interview.',
    outcome: 'UPDATED' as const,
    previousStatus: 'APPLIED' as const,
    newStatus: 'INTERVIEW_SCHEDULED' as const,
  },
  {
    gmailMessageId: 'seed-orbit-received',
    applicationId: 'seed-orbit',
    fromAddress: 'Orbit Works Careers <careers@orbitworks.example>',
    subject: 'We received your application',
    receivedAt: new Date('2026-09-10T15:40:00Z'),
    category: 'APPLICATION_RECEIVED' as const,
    companyName: 'Orbit Works',
    jobTitle: 'Frontend Developer',
    confidence: 0.97,
    reason: 'Automatic confirmation that the application was received.',
    outcome: 'NO_CHANGE' as const,
    previousStatus: 'APPLIED' as const,
    newStatus: null,
  },
  {
    gmailMessageId: 'seed-orbit-rejection',
    applicationId: 'seed-orbit',
    fromAddress: 'Orbit Works Careers <careers@orbitworks.example>',
    subject: 'Update on your application',
    receivedAt: new Date('2026-09-24T08:05:00Z'),
    category: 'REJECTION' as const,
    companyName: 'Orbit Works',
    jobTitle: 'Frontend Developer',
    confidence: 0.92,
    reason: 'The company decided to continue with other candidates.',
    outcome: 'UPDATED' as const,
    previousStatus: 'APPLIED' as const,
    newStatus: 'REJECTED' as const,
  },
];

async function main() {
  const reset = process.argv.includes('--reset');
  const existing = await prisma.jobApplication.count();

  if (existing > 0 && !reset) {
    console.log(
      `The database already has ${existing} applications, so nothing was added.\n` +
        'Run "pnpm --filter server db:seed:reset" to delete them and load the demo data.',
    );
    return;
  }

  await prisma.$transaction([
    prisma.emailEvent.deleteMany(),
    prisma.jobApplication.deleteMany(),
    prisma.jobApplication.createMany({
      data: applications.map((application) => ({
        ...application,
        currency: 'PLN',
        appliedDate: application.appliedDate
          ? new Date(application.appliedDate)
          : null,
      })),
    }),
    prisma.emailEvent.createMany({ data: emailEvents }),
  ]);

  console.log(
    `Loaded ${applications.length} applications and ${emailEvents.length} email events.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
