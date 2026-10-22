import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationsPage } from '../../components/ApplicationsPage';
import type { JobApplicationResponse } from '../../types/JobApplication';
import {
  applications as mockApplications,
  setMockApplications,
} from '../mock-api';

function makeApplication(
  overrides: Partial<JobApplicationResponse> &
    Pick<JobApplicationResponse, 'id'>,
): JobApplicationResponse {
  return {
    companyName: 'Acorn Labs',
    jobTitle: 'Frontend Engineer',
    jobUrl: null,
    status: 'APPLIED',
    salaryMin: 12000,
    salaryMax: 16000,
    currency: 'PLN',
    appliedDate: '2026-10-01T00:00:00.000Z',
    notes: null,
    ...overrides,
    id: overrides.id,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApplicationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setMobileViewport(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('ApplicationsPage API integration', () => {
  beforeEach(() => {
    setMobileViewport(false);
    setMockApplications([
      makeApplication({ id: 'app-1', companyName: 'Acorn Labs' }),
      makeApplication({
        id: 'app-2',
        companyName: 'Cedar Cloud',
        jobTitle: 'React Developer',
        notes: 'Referral from a teammate',
        appliedDate: '2026-09-12T00:00:00.000Z',
      }),
    ]);
  });

  afterEach(() => cleanup());

  it('loads applications from the intercepted API and filters by note text', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Acorn Labs')).toBeInTheDocument();
    expect(screen.getByText('Cedar Cloud')).toBeInTheDocument();

    await user.type(
      screen.getByRole('searchbox', { name: /search company/i }),
      'referral',
    );

    expect(screen.queryByText('Acorn Labs')).not.toBeInTheDocument();
    expect(screen.getByText('Cedar Cloud')).toBeInTheDocument();
  });

  it('submits the add dialog and refreshes the application query', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /add application/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Company'), 'Signal Studio');
    await user.type(within(dialog).getByLabelText('Job title'), 'UI Engineer');
    await user.type(within(dialog).getByLabelText('Notes'), 'Integration test');
    await user.click(
      within(dialog).getByRole('button', { name: /save application/i }),
    );

    expect(await screen.findByText('Signal Studio')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('shows the API error state instead of treating a failed response as empty data', async () => {
    const { server } = await import('../mock-api');
    const { http, HttpResponse } = await import('msw');
    server.use(
      http.get('/api/applications', () =>
        HttpResponse.json({ message: 'Unavailable' }, { status: 503 }),
      ),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load applications',
    );
  });

  it('moves an application with the mobile status menu and updates the board', async () => {
    setMobileViewport(true);
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('region', { name: 'Saved applications' });
    await user.click(
      screen.getByRole('button', { name: 'Next status column' }),
    );
    await screen.findByText('Acorn Labs');
    await user.click(
      screen.getAllByRole('button', { name: 'Change application status' })[0],
    );
    await user.click(screen.getByRole('menuitem', { name: 'Move to Saved' }));

    const savedColumn = screen.getByRole('region', {
      name: 'Saved applications',
    });
    expect(
      await within(savedColumn).findByText('Acorn Labs'),
    ).toBeInTheDocument();
    expect(
      mockApplications.find((application) => application.id === 'app-1')
        ?.status,
    ).toBe('SAVED');
  });

  it('confirms and batch-deletes selected applications', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Acorn Labs');
    await user.click(screen.getByRole('button', { name: 'Select visible' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete 2 applications?');
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete permanently' }),
    );

    expect(await screen.findByText('Showing 0 of 0')).toBeInTheDocument();
    expect(mockApplications).toHaveLength(0);
  });
});
