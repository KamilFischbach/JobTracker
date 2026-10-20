import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ApplicationStatus } from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';

export type CreateApplicationInput = {
  companyName: string;
  jobTitle: string;
  jobUrl?: string;
  salaryMin?: number;
  salaryMax?: number;
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
];

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
          status: 'SAVED',
          salaryMin: input.salaryMin ?? null,
          salaryMax: input.salaryMax ?? null,
          currency: 'PLN',
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
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | { applications?: PersistedApplication[] }
          | undefined;

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
