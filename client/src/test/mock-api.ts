import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { JobApplicationResponse } from '../types/JobApplication';

export let applications: JobApplicationResponse[] = [];

export function setMockApplications(next: JobApplicationResponse[]) {
  applications = next;
}

export const server = setupServer(
  http.get('/api/applications', () => HttpResponse.json(applications)),
  http.get('/api/applications/:id', ({ params }) => {
    const application = applications.find((item) => item.id === params.id);
    return application
      ? HttpResponse.json(application)
      : HttpResponse.json(
          { message: 'Application not found.' },
          { status: 404 },
        );
  }),
  http.post('/api/applications', async ({ request }) => {
    const input = (await request.json()) as Partial<JobApplicationResponse>;
    const application: JobApplicationResponse = {
      id: `test-${applications.length + 1}`,
      companyName: input.companyName ?? '',
      jobTitle: input.jobTitle ?? '',
      jobUrl: input.jobUrl ?? null,
      status: 'SAVED',
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      currency: input.currency ?? 'PLN',
      appliedDate: input.appliedDate ?? null,
      notes: input.notes ?? null,
    };
    applications = [application, ...applications];
    return HttpResponse.json(application, { status: 201 });
  }),
  http.patch('/api/applications/:id', async ({ params, request }) => {
    const input = (await request.json()) as { status?: string };
    const index = applications.findIndex((item) => item.id === params.id);
    if (index === -1) {
      return HttpResponse.json(
        { message: 'Application not found.' },
        { status: 404 },
      );
    }
    applications[index] = {
      ...applications[index],
      status: input.status as JobApplicationResponse['status'],
    };
    return HttpResponse.json(applications[index]);
  }),
  http.delete('/api/applications', async ({ request }) => {
    const input = (await request.json()) as { ids: string[] };
    const previousLength = applications.length;
    applications = applications.filter((item) => !input.ids.includes(item.id));
    return HttpResponse.json({
      deletedCount: previousLength - applications.length,
    });
  }),
);
