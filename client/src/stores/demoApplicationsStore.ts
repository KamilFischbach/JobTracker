import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ApplicationStatus } from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';

export type CreateApplicationInput = {
  companyName: string;
  jobTitle: string;
  jobUrl?: string;
  status?: ApplicationStatus;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  appliedDate?: string;
  notes?: string;
};

type PersistedApplication = Omit<JobApplicationType, 'appliedDate'> & {
  appliedDate: string | null;
};

type DemoApplicationsStore = {
  applications: JobApplicationType[];
  addApplication: (input: CreateApplicationInput) => JobApplicationType;
  updateStatus: (id: string, status: ApplicationStatus) => void;
  deleteApplications: (ids: string[]) => void;
};

const initialApplications: JobApplicationType[] = [
  {
    id: 'demo-application-1',
    companyName: 'Northstar Labs',
    jobTitle: 'Frontend Engineer',
    jobUrl: 'https://example.com/jobs/frontend-engineer',
    status: 'APPLIED',
    salaryMin: 14000,
    salaryMax: 18000,
    currency: 'PLN',
    appliedDate: new Date('2026-10-02T00:00:00'),
    notes: 'Fictional portfolio data. Follow up after a week.',
  },
  {
    id: 'demo-application-2',
    companyName: 'Mosaic Systems',
    jobTitle: 'React Developer',
    jobUrl: 'https://example.com/jobs/react-developer',
    status: 'SAVED',
    salaryMin: 12000,
    salaryMax: 16000,
    currency: 'PLN',
    appliedDate: null,
    notes: 'Review the product and team before applying.',
  },
  {
    id: 'demo-application-3',
    companyName: 'Greenfield Tech',
    jobTitle: 'Software Engineer, Web',
    jobUrl: 'https://example.com/jobs/software-engineer-web',
    status: 'INTERVIEW_SCHEDULED',
    salaryMin: 16000,
    salaryMax: 21000,
    currency: 'PLN',
    appliedDate: new Date('2026-09-25T00:00:00'),
    notes: 'Technical interview scheduled. Prepare project examples.',
  },
  {
    id: 'demo-application-4',
    companyName: 'Amber Digital',
    jobTitle: 'UI Engineer',
    jobUrl: 'https://example.com/jobs/ui-engineer',
    status: 'OFFER',
    salaryMin: 18000,
    salaryMax: 22000,
    currency: 'PLN',
    appliedDate: new Date('2026-09-18T00:00:00'),
    notes: 'Fictional offer for demonstrating the board.',
  },
  {
    id: 'demo-application-5',
    companyName: 'Orbit Works',
    jobTitle: 'Frontend Developer',
    jobUrl: 'https://example.com/jobs/frontend-developer',
    status: 'REJECTED',
    salaryMin: null,
    salaryMax: null,
    currency: 'PLN',
    appliedDate: new Date('2026-09-10T00:00:00'),
    notes: null,
  },
  {
    id: 'demo-application-6',
    companyName: 'Paperplane Studio',
    jobTitle: 'Junior Web Developer',
    jobUrl: 'https://example.com/jobs/junior-web-developer',
    status: 'SAVED',
    salaryMin: 9000,
    salaryMax: 12000,
    currency: 'PLN',
    appliedDate: null,
    notes: 'Saved for later review.',
  },
  {
    id: 'demo-application-7',
    companyName: 'Cedar Cloud',
    jobTitle: 'Frontend Developer',
    jobUrl: 'https://example.com/jobs/cedar-frontend',
    status: 'SAVED',
    salaryMin: 11000,
    salaryMax: 15000,
    currency: 'PLN',
    appliedDate: null,
    notes: 'Check the role requirements before applying.',
  },
  {
    id: 'demo-application-8',
    companyName: 'Bluejay Commerce',
    jobTitle: 'React UI Developer',
    jobUrl: 'https://example.com/jobs/react-ui',
    status: 'APPLIED',
    salaryMin: 13000,
    salaryMax: 17000,
    currency: 'PLN',
    appliedDate: new Date('2026-10-07T00:00:00'),
    notes: 'Application sent through the company website.',
  },
  {
    id: 'demo-application-9',
    companyName: 'Kitepath Software',
    jobTitle: 'Frontend Engineer',
    jobUrl: 'https://example.com/jobs/kitepath-frontend',
    status: 'APPLIED',
    salaryMin: 15000,
    salaryMax: 19000,
    currency: 'PLN',
    appliedDate: new Date('2026-10-05T00:00:00'),
    notes: 'Applied after referral.',
  },
  {
    id: 'demo-application-10',
    companyName: 'Juniper Metrics',
    jobTitle: 'Software Engineer',
    jobUrl: 'https://example.com/jobs/juniper-engineer',
    status: 'INTERVIEW_SCHEDULED',
    salaryMin: 17000,
    salaryMax: 22000,
    currency: 'PLN',
    appliedDate: new Date('2026-09-29T00:00:00'),
    notes: 'Recruiter screen scheduled.',
  },
  {
    id: 'demo-application-11',
    companyName: 'Lighthouse Apps',
    jobTitle: 'Product UI Engineer',
    jobUrl: 'https://example.com/jobs/lighthouse-ui',
    status: 'INTERVIEW_SCHEDULED',
    salaryMin: 15000,
    salaryMax: 20000,
    currency: 'PLN',
    appliedDate: new Date('2026-09-27T00:00:00'),
    notes: 'Prepare a short walkthrough of a recent project.',
  },
  {
    id: 'demo-application-12',
    companyName: 'Copperline Digital',
    jobTitle: 'Senior UI Developer',
    jobUrl: 'https://example.com/jobs/copperline-ui',
    status: 'OFFER',
    salaryMin: 20000,
    salaryMax: 24000,
    currency: 'PLN',
    appliedDate: new Date('2026-09-16T00:00:00'),
    notes: 'Fictional offer example for the demo board.',
  },
  {
    id: 'demo-application-13',
    companyName: 'Maple Ridge Tech',
    jobTitle: 'React Engineer',
    jobUrl: 'https://example.com/jobs/maple-react',
    status: 'OFFER',
    salaryMin: 19000,
    salaryMax: 23000,
    currency: 'PLN',
    appliedDate: new Date('2026-09-14T00:00:00'),
    notes: 'Compare the fictional offer with other opportunities.',
  },
  {
    id: 'demo-application-14',
    companyName: 'Willowbyte',
    jobTitle: 'Web Developer',
    jobUrl: 'https://example.com/jobs/willowbyte-web',
    status: 'REJECTED',
    salaryMin: null,
    salaryMax: null,
    currency: 'PLN',
    appliedDate: new Date('2026-09-08T00:00:00'),
    notes: 'Fictional closed application.',
  },
  {
    id: 'demo-application-15',
    companyName: 'Redwood Interfaces',
    jobTitle: 'Frontend Specialist',
    jobUrl: 'https://example.com/jobs/redwood-frontend',
    status: 'REJECTED',
    salaryMin: 14000,
    salaryMax: 18000,
    currency: 'PLN',
    appliedDate: new Date('2026-09-04T00:00:00'),
    notes: 'Fictional closed application.',
  },
  // Extra Saved and Applied samples, so those columns show "Show more".
  {
    id: 'demo-application-16',
    companyName: 'Northwind Health',
    jobTitle: 'Frontend Developer',
    jobUrl: 'https://example.com/jobs/northwind-frontend',
    status: 'SAVED',
    salaryMin: 12000,
    salaryMax: 15000,
    currency: 'PLN',
    appliedDate: null,
    notes: 'Interesting product; check the tech stack first.',
  },
  {
    id: 'demo-application-17',
    companyName: 'Sunbeam Labs',
    jobTitle: 'React Engineer',
    jobUrl: 'https://example.com/jobs/sunbeam-react',
    status: 'SAVED',
    salaryMin: 14000,
    salaryMax: 18000,
    currency: 'PLN',
    appliedDate: null,
    notes: 'Ask a contact about the team.',
  },
  {
    id: 'demo-application-18',
    companyName: 'Harbor Analytics',
    jobTitle: 'UI Developer',
    jobUrl: 'https://example.com/jobs/harbor-ui',
    status: 'SAVED',
    salaryMin: null,
    salaryMax: null,
    currency: 'PLN',
    appliedDate: null,
    notes: 'Salary not listed yet.',
  },
  {
    id: 'demo-application-19',
    companyName: 'Quartz Mobility',
    jobTitle: 'Frontend Engineer',
    jobUrl: 'https://example.com/jobs/quartz-frontend',
    status: 'APPLIED',
    salaryMin: 15000,
    salaryMax: 19000,
    currency: 'PLN',
    appliedDate: new Date('2026-10-12T00:00:00'),
    notes: 'Applied through the careers page.',
  },
  {
    id: 'demo-application-20',
    companyName: 'Pinecrest Software',
    jobTitle: 'TypeScript Developer',
    jobUrl: 'https://example.com/jobs/pinecrest-typescript',
    status: 'APPLIED',
    salaryMin: 13000,
    salaryMax: 17000,
    currency: 'PLN',
    appliedDate: new Date('2026-10-10T00:00:00'),
    notes: 'Waiting for a reply.',
  },
  {
    id: 'demo-application-21',
    companyName: 'Lumen Commerce',
    jobTitle: 'Web Developer',
    jobUrl: 'https://example.com/jobs/lumen-web',
    status: 'APPLIED',
    salaryMin: 11000,
    salaryMax: 14000,
    currency: 'PLN',
    appliedDate: new Date('2026-10-09T00:00:00'),
    notes: null,
  },
  {
    id: 'demo-application-22',
    companyName: 'Atlas Robotics',
    jobTitle: 'Frontend Developer',
    jobUrl: 'https://example.com/jobs/atlas-frontend',
    status: 'APPLIED',
    salaryMin: 16000,
    salaryMax: 20000,
    currency: 'PLN',
    appliedDate: new Date('2026-10-03T00:00:00'),
    notes: 'Follow up next week.',
  },
];

// Samples added in store version 3 (see migrate below).
const ADDED_IN_VERSION_3 = new Set(
  Array.from({ length: 7 }, (_, index) => `demo-application-${index + 16}`),
);

export const useDemoApplicationsStore = create<DemoApplicationsStore>()(
  persist(
    (set) => ({
      applications: initialApplications,
      addApplication: (input) => {
        const application: JobApplicationType = {
          id: crypto.randomUUID(),
          companyName: input.companyName,
          jobTitle: input.jobTitle,
          jobUrl: input.jobUrl ?? null,
          status: input.status ?? 'SAVED',
          salaryMin: input.salaryMin ?? null,
          salaryMax: input.salaryMax ?? null,
          currency: input.currency ?? 'PLN',
          appliedDate: input.appliedDate
            ? new Date(`${input.appliedDate}T00:00:00`)
            : null,
          notes: input.notes ?? null,
        };

        set((state) => ({
          applications: [application, ...state.applications],
        }));
        return application;
      },
      updateStatus: (id, status) =>
        set((state) => ({
          applications: state.applications.map((application) =>
            application.id === id ? { ...application, status } : application,
          ),
        })),
      deleteApplications: (ids) =>
        set((state) => ({
          applications: state.applications.filter(
            (application) => !ids.includes(application.id),
          ),
        })),
    }),
    {
      name: 'job-tracker-demo-applications-v1',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        const persisted = persistedState as
          { applications?: PersistedApplication[] } | undefined;
        if (!persisted?.applications) return persistedState;

        // Before v2: add every missing sample. Before v3: add only the samples
        // new in v3, so applications the visitor deleted stay deleted.
        const toAdd =
          version < 2
            ? initialApplications
            : version < 3
              ? initialApplications.filter((application) =>
                  ADDED_IN_VERSION_3.has(application.id),
                )
              : [];
        const existingIds = new Set(
          persisted.applications.map((application) => application.id),
        );
        return {
          ...persisted,
          applications: [
            ...persisted.applications,
            ...toAdd.filter((application) => !existingIds.has(application.id)),
          ],
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          { applications?: PersistedApplication[] } | undefined;

        return {
          ...currentState,
          applications: persisted?.applications
            ? persisted.applications.map((application) => ({
                ...application,
                appliedDate: application.appliedDate
                  ? new Date(application.appliedDate)
                  : null,
              }))
            : currentState.applications,
        };
      },
    },
  ),
);
