import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSessionCache } from '../../hooks/useCurrentUser';
import { newPasswordProblem, tokenFromHash } from '../../lib/password-rules';
import { resetPassword } from '../../services/auth';
import { AuthLayout, FormMessage } from './AuthLayout';
import { FormField } from './FormField';

/**
 * `/reset-password#token=…`, opened from the reset email. The server logs
 * out every session, so the user logs in again with the new password.
 */
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setLoggedOut } = useSessionCache();
  const [token] = useState(() => tokenFromHash(location.hash));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // Keep the token out of the address bar and history.
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const resetMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      setLoggedOut();
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password was changed. Log in with the new one.' },
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = newPasswordProblem(password, confirmation);
    setProblem(found);
    if (found || !token) return;
    resetMutation.mutate({ token, password });
  }

  if (!token) {
    return (
      <AuthLayout
        title='Link not valid'
        footer={<Link to='/forgot-password'>Request a new link</Link>}
      >
        <FormMessage tone='error'>
          This link is incomplete. Open the link from the email again.
        </FormMessage>
      </AuthLayout>
    );
  }

  const error =
    problem ?? (resetMutation.isError ? resetMutation.error.message : null);

  return (
    <AuthLayout
      title='Choose a new password'
      footer={<Link to='/forgot-password'>Request a new link</Link>}
    >
      <form className='grid gap-4' onSubmit={handleSubmit} noValidate>
        <FormField
          label='New password'
          type='password'
          autoComplete='new-password'
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormField
          label='Repeat new password'
          type='password'
          autoComplete='new-password'
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {error && <FormMessage tone='error'>{error}</FormMessage>}
        <Button type='submit' size='lg' disabled={resetMutation.isPending}>
          {resetMutation.isPending ? 'Saving...' : 'Set new password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
