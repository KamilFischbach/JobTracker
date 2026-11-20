import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';

/** Board header note for temporary "Try demo" accounts. */
export function DemoAccountNotice() {
  const { data: user } = useCurrentUser();
  if (!user?.isDemo) return null;

  return (
    <p className='flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-glass px-3 py-1 text-xs text-indigo-950/80 ring-1 ring-line backdrop-blur dark:text-indigo-200/80'>
      Demo account: your changes are deleted after 24 hours.
      <Link to='/signup' className='font-medium'>
        Create a free account
      </Link>
    </p>
  );
}
