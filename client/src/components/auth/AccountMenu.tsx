import { useMutation } from '@tanstack/react-query';
import { LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentUser, useSessionCache } from '../../hooks/useCurrentUser';
import { logout } from '../../services/auth';

const pillClass =
  'inline-flex h-10 items-center gap-2 rounded-full bg-glass px-3 text-sm text-ink no-underline ring-1 ring-line backdrop-blur transition-colors hover:bg-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Account link and log-out button for the board header. */
export function AccountMenu() {
  const { data: user } = useCurrentUser();
  const { setLoggedOut } = useSessionCache();

  const logoutMutation = useMutation({
    mutationFn: logout,
    // Forget the session locally even if the request failed.
    onSettled: () => setLoggedOut(),
  });

  if (!user) return null;

  return (
    <div className='flex items-center gap-2'>
      <Link to='/account' className={pillClass} title='Account settings'>
        <UserRound aria-hidden='true' className='size-4' />
        <span className='hidden max-w-48 truncate sm:inline'>
          {user.isDemo ? 'Demo account' : user.email}
        </span>
        <span className='sm:hidden'>Account</span>
      </Link>
      <button
        type='button'
        aria-label='Log out'
        title='Log out'
        className={`${pillClass} w-10 justify-center px-0`}
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
      >
        <LogOut aria-hidden='true' className='size-4' />
      </button>
    </div>
  );
}
