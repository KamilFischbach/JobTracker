import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { type LoggedOut, loggedOutQueryKey } from '../../lib/query-client';

function CheckingSession() {
  return (
    <main className='grid min-h-svh place-items-center'>
      <p role='status' className='text-sm text-ink-muted'>
        Loading...
      </p>
    </main>
  );
}

/**
 * Shows the nested routes only to logged-in users. Others go to the login
 * page: after an intentional logout with its notice, otherwise with
 * `?next=` so it brings them back afterwards.
 */
export function RequireAuth() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isPending, isError, refetch } = useCurrentUser();

  if (isPending) return <CheckingSession />;
  if (isError) {
    return (
      <main className='grid min-h-svh place-items-center px-4'>
        <div role='alert' className='flex flex-col items-center gap-3 text-center'>
          <p className='text-sm text-ink-muted'>
            Could not reach the server. Check your connection.
          </p>
          <Button type='button' onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }
  if (!user) {
    const loggedOut = queryClient.getQueryData<LoggedOut>(loggedOutQueryKey);
    if (loggedOut) {
      return (
        <Navigate
          to='/login'
          replace
          state={loggedOut.notice ? { notice: loggedOut.notice } : null}
        />
      );
    }
    const next = `${location.pathname}${location.search}`;
    return (
      <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
    );
  }
  return <Outlet />;
}

/**
 * Shows the nested routes (login, sign-up) only to logged-out visitors.
 */
export function GuestOnly() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) return <CheckingSession />;
  if (user) return <Navigate to='/applications' replace />;
  return <Outlet />;
}
