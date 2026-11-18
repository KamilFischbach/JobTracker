import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDetailsPage } from '../../components/ApplicationDetailsPage';
import type { EmailEvent } from '../../types/EmailEvent';
import { server, setMockApplications } from '../mock-api';

function renderDetails(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/applications/${id}`]}>
        <Routes>
          <Route
            path='/applications/:applicationId'
            element={<ApplicationDetailsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const interviewEmail: EmailEvent = {
  id: 'event-1',
  fromAddress: 'Anna Nowak <anna.nowak@acornlabs.pl>',
  subject: 'Zaproszenie na rozmowę',
  receivedAt: '2026-10-28T09:15:00.000Z',
  category: 'INTERVIEW_INVITATION',
  confidence: 0.95,
  reason: 'The recruiter proposes interview dates.',
  outcome: 'UPDATED',
  previousStatus: 'APPLIED',
  newStatus: 'INTERVIEW_SCHEDULED',
};

describe('ApplicationDetailsPage email activity', () => {
  beforeEach(() => {
    // Email activity only shows when the automation is enabled.
    vi.stubEnv('VITE_EMAIL_AUTOMATION', 'true');
    setMockApplications([
      {
        id: 'app-1',
        companyName: 'Acorn Labs',
        jobTitle: 'Junior AI Automation Developer',
        jobUrl: null,
        status: 'INTERVIEW_SCHEDULED',
        salaryMin: null,
        salaryMax: null,
        currency: 'PLN',
        appliedDate: '2026-10-20T00:00:00.000Z',
        notes: null,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows emails the automation linked, with the AI decision and status change', async () => {
    server.use(
      http.get('/api/applications/:id/email-events', () =>
        HttpResponse.json([
          interviewEmail,
          {
            ...interviewEmail,
            id: 'event-2',
            subject: 'Quick question',
            category: 'REJECTION',
            confidence: 0.55,
            reason: 'Unclear wording.',
            outcome: 'NEEDS_REVIEW',
            newStatus: null,
          },
        ]),
      ),
    );

    renderDetails('app-1');

    expect(
      await screen.findByText('Zaproszenie na rozmowę'),
    ).toBeInTheDocument();
    expect(screen.getByText('Interview invitation')).toBeInTheDocument();
    expect(screen.getByText('(95% sure)')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Status changed from Applied to Interview'),
    ).toBeInTheDocument();
    expect(screen.getByText(/the AI was unsure/i)).toBeInTheDocument();
  });

  it('says when there are no emails yet', async () => {
    server.use(
      http.get('/api/applications/:id/email-events', () =>
        HttpResponse.json([]),
      ),
    );

    renderDetails('app-1');

    expect(
      await screen.findByText('No emails about this application yet.'),
    ).toBeInTheDocument();
  });
});
