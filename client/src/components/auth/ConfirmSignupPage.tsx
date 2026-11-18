import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSessionCache } from '../../hooks/useCurrentUser';
import { tokenFromHash } from '../../lib/password-rules';
import { confirmSignup } from '../../services/auth';
import { AuthLayout, FormMessage } from './AuthLayout';

/**
 * `/confirm-signup#token=…`, opened from the sign-up email. Creates the
 * account, logs in and opens the board.
 */
export function ConfirmSignupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setLoggedIn } = useSessionCache();
  const [token] = useState(() => tokenFromHash(location.hash));
  // The link works once; Strict Mode runs effects twice in development.
  const started = useRef(false);

  const confirmMutation = useMutation({
    mutationFn: confirmSignup,
    onSuccess: (user) => {
      setLoggedIn(user);
      navigate('/applications', { replace: true });
    },
  });
  const { mutate } = confirmMutation;

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    // Keep the token out of the address bar and history.
    navigate(location.pathname, { replace: true });
    mutate(token);
  }, [token, mutate, navigate, location.pathname]);

  const failed = !token || confirmMutation.isError;

  return (
    <AuthLayout
      title={failed ? 'Link not valid' : 'Creating your account'}
      footer={
        failed && (
          <p>
            <Link to='/signup'>Sign up again</Link> or{' '}
            <Link to='/login'>log in</Link>
          </p>
        )
      }
    >
      {failed ? (
        <FormMessage tone='error'>
          {confirmMutation.error?.message ??
            'This link is incomplete. Open the link from the email again.'}
        </FormMessage>
      ) : (
        <p role='status' className='text-sm text-ink-muted'>
          Confirming your email...
        </p>
      )}
    </AuthLayout>
  );
}
