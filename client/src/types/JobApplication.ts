import type { ApplicationStatus } from './ApplicationStatus';

export type JobApplicationType = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string | null;
  status: ApplicationStatus;
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string;
  appliedDate: Date | null;
  notes: string | null;
};

export type JobApplicationResponse = Omit<JobApplicationType, 'appliedDate'> & {
  appliedDate: string | null;
};
