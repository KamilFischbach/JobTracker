import {
  type CreateApplicationInput,
  useDemoApplicationsStore,
} from '../stores/demoApplicationsStore';
import type { ApplicationStatus } from '../types/ApplicationStatus';
import { toApiError } from './api-error';
import type { EmailEvent } from '../types/EmailEvent';
import type {
  JobApplicationResponse,
  JobApplicationType,
} from '../types/JobApplication';

export type { CreateApplicationInput };

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Whether to show the n8n email activity. Off unless `VITE_EMAIL_AUTOMATION`
 * is `true`, matching the server's `ENABLE_EMAIL_WEBHOOK` (single-user only).
 * Read on each call so tests can switch it.
 */
export function isEmailAutomationEnabled(): boolean {
  return import.meta.env.VITE_EMAIL_AUTOMATION === 'true';
}

function parseApplication(
  application: JobApplicationResponse,
): JobApplicationType {
  return {
    ...application,
    appliedDate: application.appliedDate
      ? new Date(`${application.appliedDate.slice(0, 10)}T00:00:00`)
      : null,
  };
}

export async function getApplications(): Promise<JobApplicationType[]> {
  if (isDemoMode) return useDemoApplicationsStore.getState().applications;

  const response = await fetch('/api/applications');
  if (!response.ok) {
    throw await toApiError(response, 'Could not load applications');
  }

  const applications: JobApplicationResponse[] = await response.json();
  return applications.map(parseApplication);
}

export async function getApplication(id: string): Promise<JobApplicationType> {
  if (isDemoMode) {
    const application = useDemoApplicationsStore
      .getState()
      .applications.find((item) => item.id === id);
    if (!application) throw new Error('Application not found.');
    return application;
  }

  const response = await fetch(`/api/applications/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw await toApiError(response, 'Could not load application');
  }

  return parseApplication(await response.json());
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<void> {
  if (isDemoMode) {
    useDemoApplicationsStore.getState().addApplication(input);
    return;
  }

  const response = await fetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await toApiError(response, 'Could not create application');
  }
}

export async function updateApplicationStatus({
  id,
  status,
}: {
  id: string;
  status: ApplicationStatus;
}): Promise<void> {
  if (isDemoMode) {
    useDemoApplicationsStore.getState().updateStatus(id, status);
    return;
  }

  const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw await toApiError(response, 'Could not update status');
  }
}

// Emails the n8n workflow linked to an application. The demo has no backend.
export async function getEmailEvents(
  applicationId: string,
): Promise<EmailEvent[]> {
  if (isDemoMode) return [];

  const response = await fetch(
    `/api/applications/${encodeURIComponent(applicationId)}/email-events`,
  );
  if (!response.ok) {
    throw await toApiError(response, 'Could not load email activity');
  }

  return response.json();
}

export type OfferDraft = {
  companyName: string | null;
  jobTitle: string | null;
  jobUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  notes: string | null;
  warning: string | null;
};

// Asks the backend AI to read a job offer (from the link, or from pasted text).
export async function parseOffer(input: {
  url: string;
  text?: string;
}): Promise<OfferDraft> {
  const response = await fetch('/api/ai/parse-offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await toApiError(response, 'Could not read the offer');
  }

  return response.json();
}

export async function deleteApplications(ids: string[]): Promise<void> {
  if (isDemoMode) {
    useDemoApplicationsStore.getState().deleteApplications(ids);
    return;
  }

  const response = await fetch('/api/applications', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw await toApiError(response, 'Could not delete applications');
  }
}
