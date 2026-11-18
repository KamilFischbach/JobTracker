import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { AuthUser } from '../types/AuthUser';
import type { JobApplicationResponse } from '../types/JobApplication';

export let applications: JobApplicationResponse[] = [];

/** Password the mock API accepts for {@link MOCK_USER}. */
export const MOCK_PASSWORD = 'correct horse battery';
/** Link token the mock API accepts for sign-up and reset links. */
export const VALID_LINK_TOKEN = 'valid-link-token';
export const MOCK_USER: AuthUser = {
  id: 'user-1',
  email: 'kamil@example.com',
  isDemo: false,
};

// Logged in by default, so page tests do not need to log in first.
let currentUser: AuthUser | null = MOCK_USER;

/**
 * Sets who the mock API thinks is logged in (null: nobody).
 *
 * @param {AuthUser | null} user
 */
export function setMockUser(user: AuthUser | null) {
  currentUser = user;
}

function error(status: number, code: string, message: string) {
  return HttpResponse.json({ code, message }, { status });
}

const authHandlers = [
  http.get('/api/auth/me', () =>
    currentUser
      ? HttpResponse.json(currentUser)
      : error(401, 'UNAUTHENTICATED', 'Log in to continue.'),
  ),
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as Record<string, string>;
    if (email?.trim().toLowerCase() !== MOCK_USER.email || password !== MOCK_PASSWORD) {
      return error(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    currentUser = MOCK_USER;
    return HttpResponse.json(MOCK_USER);
  }),
  http.post('/api/auth/logout', () => {
    currentUser = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('/api/auth/signup', () =>
    HttpResponse.json({ message: 'Check your inbox.' }, { status: 202 }),
  ),
  http.post('/api/auth/confirm-signup', async ({ request }) => {
    const { token } = (await request.json()) as Record<string, string>;
    if (token !== VALID_LINK_TOKEN) {
      return error(400, 'INVALID_LINK', 'This link is invalid or has expired. Request a new one.');
    }
    currentUser = MOCK_USER;
    return HttpResponse.json(MOCK_USER, { status: 201 });
  }),
  http.post('/api/auth/forgot-password', () =>
    HttpResponse.json({ message: 'Check your inbox.' }, { status: 202 }),
  ),
  http.post('/api/auth/reset-password', async ({ request }) => {
    const { token } = (await request.json()) as Record<string, string>;
    if (token !== VALID_LINK_TOKEN) {
      return error(400, 'INVALID_LINK', 'This link is invalid or has expired. Request a new one.');
    }
    currentUser = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('/api/auth/password', async ({ request }) => {
    const { currentPassword } = (await request.json()) as Record<string, string>;
    return currentPassword === MOCK_PASSWORD
      ? new HttpResponse(null, { status: 204 })
      : error(400, 'WRONG_PASSWORD', 'The password is not correct.');
  }),
  http.delete('/api/auth/account', async ({ request }) => {
    const { password } = (await request.json()) as Record<string, string>;
    if (password !== MOCK_PASSWORD) {
      return error(400, 'WRONG_PASSWORD', 'The password is not correct.');
    }
    currentUser = null;
    return new HttpResponse(null, { status: 204 });
  }),
];

export function setMockApplications(next: JobApplicationResponse[]) {
  applications = next;
}

export const server = setupServer(
  ...authHandlers,
  http.get('/api/ai/usage', () => HttpResponse.json({ used: 1, limit: 20 })),
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
