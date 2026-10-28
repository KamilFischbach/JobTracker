import {
  type CreateApplicationInput,
  useDemoApplicationsStore,
} from '../stores/demoApplicationsStore';
import type { ApplicationStatus } from '../types/ApplicationStatus';
import type {
  JobApplicationResponse,
  JobApplicationType,
} from '../types/JobApplication';

export type { CreateApplicationInput };

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

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

async function parseResponseError(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) return new Error(`${fallback} (${response.status}).`);

  try {
    const body = JSON.parse(text) as { message?: string };
    return new Error(body.message ?? text);
  } catch {
    return new Error(text);
  }
}

export async function getApplications(): Promise<JobApplicationType[]> {
  if (isDemoMode) return useDemoApplicationsStore.getState().applications;

  const response = await fetch('/api/applications');
  if (!response.ok) {
    throw new Error(
      `Could not load applications (${response.status} ${response.statusText}).`,
    );
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
    throw await parseResponseError(response, 'Could not load application');
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
    throw await parseResponseError(response, 'Could not create application');
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
    throw await parseResponseError(response, 'Could not update status');
  }
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

export class OfferImportError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.code = code;
  }
}

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
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    throw new OfferImportError(
      body.message ?? `Could not read the offer (${response.status}).`,
      body.code ?? null,
    );
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
    throw await parseResponseError(response, 'Could not delete applications');
  }
}
