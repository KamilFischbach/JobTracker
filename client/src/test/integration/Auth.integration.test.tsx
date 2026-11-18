import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';
import { createQueryClient } from '../../lib/query-client';
import type { JobApplicationResponse } from '../../types/JobApplication';
import {
  MOCK_DEMO_USER,
  MOCK_PASSWORD,
  MOCK_USER,
  server,
  setMockApplications,
  setMockUser,
  VALID_LINK_TOKEN,
} from '../mock-api';

const NEW_PASSWORD = 'a brand new passphrase';

const application: JobApplicationResponse = {
  id: 'app-1',
  companyName: 'Acorn Labs',
  jobTitle: 'Frontend Engineer',
  jobUrl: null,
  status: 'APPLIED',
  salaryMin: null,
  salaryMax: null,
  currency: 'PLN',
  appliedDate: '2026-10-01T00:00:00.000Z',
  notes: null,
};

function renderApp(url: string) {
  const queryClient = createQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillIn(label: string, value: string) {
  await userEvent.type(screen.getByLabelText(label), value);
}

async function logIn(password = MOCK_PASSWORD) {
  await fillIn('Email', MOCK_USER.email ?? '');
  await fillIn('Password', password);
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

async function expectBoard() {
  expect(
    await screen.findByRole('heading', { name: 'Applications' }),
  ).toBeInTheDocument();
  expect(await screen.findByText('Acorn Labs')).toBeInTheDocument();
}

describe('authentication', () => {
  beforeEach(() => {
    setMockApplications([application]);
  });

  afterEach(() => cleanup());

  describe('logging in', () => {
    beforeEach(() => setMockUser(null));

    it('sends visitors to the login page and back to where they were going', async () => {
      renderApp('/applications/app-1');

      expect(
        await screen.findByRole('heading', { name: 'Log in' }),
      ).toBeInTheDocument();
      await logIn();

      expect(
        await screen.findByRole('heading', { name: 'Application details' }),
      ).toBeInTheDocument();
    });

    it('shows the server message for a wrong password', async () => {
      renderApp('/login');

      await screen.findByRole('heading', { name: 'Log in' });
      await logIn('wrong password!!');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Invalid email or password.',
      );
    });

    it('never follows a ?next= link to another site', async () => {
      renderApp('/login?next=//evil.example/phish');

      await screen.findByRole('heading', { name: 'Log in' });
      await logIn();

      await expectBoard();
    });

    it('sends the user to the login page when the session expires', async () => {
      setMockUser(MOCK_USER);
      server.use(
        http.get('/api/applications', () =>
          HttpResponse.json(
            { code: 'UNAUTHENTICATED', message: 'Log in to continue.' },
            { status: 401 },
          ),
        ),
      );

      renderApp('/applications');

      expect(
        await screen.findByRole('heading', { name: 'Log in' }),
      ).toBeInTheDocument();
    });
  });

  it('sends logged-in users from the login page to the board', async () => {
    renderApp('/login');
    await expectBoard();
  });

  describe('trying the demo', () => {
    beforeEach(() => setMockUser(null));

    it('starts a demo account from the login page and shows the demo notice', async () => {
      renderApp('/login');

      await userEvent.click(
        await screen.findByRole('button', { name: 'Try the demo' }),
      );

      await expectBoard();
      expect(
        screen.getByText(/Demo account: your changes are deleted after 24 hours/),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Demo account/ })).toBeInTheDocument();
    });

    it('lets a demo user open the sign-up page', async () => {
      setMockUser(MOCK_DEMO_USER);
      renderApp('/applications');

      await userEvent.click(
        await screen.findByRole('link', { name: 'Create a free account' }),
      );

      expect(
        await screen.findByRole('heading', { name: 'Create an account' }),
      ).toBeInTheDocument();
    });

    it('shows no password or delete options on a demo account', async () => {
      setMockUser(MOCK_DEMO_USER);
      renderApp('/account');

      expect(
        await screen.findByText(/This is a temporary demo account/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Change password' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete my account' })).toBeNull();
    });
  });

  describe('signing up', () => {
    beforeEach(() => setMockUser(null));

    it('checks the repeated password before sending anything', async () => {
      renderApp('/signup');
      await screen.findByRole('heading', { name: 'Create an account' });

      await fillIn('Email', 'new@example.com');
      await fillIn('Password', NEW_PASSWORD);
      await fillIn('Repeat password', 'something else entirely');
      await userEvent.click(
        screen.getByRole('button', { name: 'Create account' }),
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The passwords do not match.',
      );
    });

    it('asks the user to check their inbox', async () => {
      renderApp('/signup');
      await screen.findByRole('heading', { name: 'Create an account' });

      await fillIn('Email', 'new@example.com');
      await fillIn('Password', NEW_PASSWORD);
      await fillIn('Repeat password', NEW_PASSWORD);
      await userEvent.click(
        screen.getByRole('button', { name: 'Create account' }),
      );

      const message = await screen.findByRole('status');
      expect(message).toHaveTextContent('Check your inbox');
      expect(message).toHaveTextContent('new@example.com');
    });

    it('logs in and opens the board from the confirmation link', async () => {
      renderApp(`/confirm-signup#token=${VALID_LINK_TOKEN}`);
      await expectBoard();
    });

    it('explains when the confirmation link does not work', async () => {
      renderApp('/confirm-signup#token=used-token');

      expect(
        await screen.findByRole('heading', { name: 'Link not valid' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This link is invalid or has expired.',
      );
      expect(
        screen.getByRole('link', { name: 'Sign up again' }),
      ).toBeInTheDocument();
    });
  });

  describe('resetting a forgotten password', () => {
    beforeEach(() => setMockUser(null));

    it('asks the user to check their inbox', async () => {
      renderApp('/login');

      await userEvent.click(
        await screen.findByRole('link', { name: 'Forgot password?' }),
      );
      await fillIn('Email', 'kamil@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Send link' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Check your inbox',
      );
    });

    it('sets the new password and asks the user to log in with it', async () => {
      renderApp(`/reset-password#token=${VALID_LINK_TOKEN}`);

      await fillIn('New password', NEW_PASSWORD);
      await fillIn('Repeat new password', NEW_PASSWORD);
      await userEvent.click(
        screen.getByRole('button', { name: 'Set new password' }),
      );

      expect(
        await screen.findByRole('heading', { name: 'Log in' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your password was changed.',
      );
    });

    it('explains a link without a token', async () => {
      renderApp('/reset-password');

      expect(
        await screen.findByRole('heading', { name: 'Link not valid' }),
      ).toBeInTheDocument();
    });
  });

  describe('account page', () => {
    it('is reachable from the board header', async () => {
      renderApp('/applications');

      await userEvent.click(
        await screen.findByRole('link', { name: /kamil@example.com/ }),
      );

      expect(
        await screen.findByRole('heading', { name: 'Account' }),
      ).toBeInTheDocument();
    });

    it('changes the password, showing a wrong current password first', async () => {
      renderApp('/account');
      await screen.findByRole('heading', { name: 'Account' });

      await fillIn('Current password', 'not my password');
      await fillIn('New password', NEW_PASSWORD);
      await fillIn('Repeat new password', NEW_PASSWORD);
      await userEvent.click(
        screen.getByRole('button', { name: 'Change password' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The password is not correct.',
      );
      // A wrong password is not a lost session: the page stays.
      expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();

      await userEvent.clear(screen.getByLabelText('Current password'));
      await fillIn('Current password', MOCK_PASSWORD);
      await userEvent.click(
        screen.getByRole('button', { name: 'Change password' }),
      );
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Password changed.',
      );
    });

    it('deletes the account after asking for the password', async () => {
      renderApp('/account');

      await userEvent.click(
        await screen.findByRole('button', { name: 'Delete my account' }),
      );
      await fillIn('Password', MOCK_PASSWORD);
      await userEvent.click(
        screen.getByRole('button', { name: 'Delete account permanently' }),
      );

      expect(
        await screen.findByRole('heading', { name: 'Log in' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your account and all its data were deleted.',
      );
    });

    it('logs out from the board header', async () => {
      renderApp('/applications');

      await userEvent.click(
        await screen.findByRole('button', { name: 'Log out' }),
      );

      expect(
        await screen.findByRole('heading', { name: 'Log in' }),
      ).toBeInTheDocument();
      // Going back to the board needs a new login.
      expect(within(document.body).queryByText('Acorn Labs')).toBeNull();
    });
  });
});
