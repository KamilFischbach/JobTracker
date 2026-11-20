import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionCache } from '../../hooks/useCurrentUser';
import { safeNextPath } from '../../lib/safe-next-path';
import { login } from '../../services/auth';
import { AuthLayout, FormMessage } from './AuthLayout';
import { FormField } from './FormField';
import { TryDemo } from './TryDemo';

/**
 * `/login`. After logging in, goes to `?next=` (pages of this app only).
 * Other pages can pass a notice in the navigation state, e.g. after a
 * password reset.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setLoggedIn } = useSessionCache();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const notice = (location.state as { notice?: string } | null)?.notice;

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      setLoggedIn(user);
      navigate(safeNextPath(searchParams.get('next')), { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  return (
    <AuthLayout
      title='Log in'
      description='Welcome back. Your board is waiting.'
      footer={
        <p>
          New here? <Link to='/signup'>Create an account</Link>
        </p>
      }
    >
      <form className='grid gap-4' onSubmit={handleSubmit} noValidate>
        {notice && !loginMutation.isError && (
          <FormMessage tone='success'>{notice}</FormMessage>
        )}
        <FormField
          label='Email'
          type='email'
          autoComplete='email'
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormField
          label='Password'
          type='password'
          autoComplete='current-password'
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Link to='/forgot-password' className='-mt-2 justify-self-end text-sm'>
          Forgot password?
        </Link>
        {loginMutation.isError && (
          <FormMessage tone='error'>{loginMutation.error.message}</FormMessage>
        )}
        <Button type='submit' size='lg' disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Logging in...' : 'Log in'}
        </Button>
      </form>
      <div className='mt-6'>
        <TryDemo />
      </div>
    </AuthLayout>
  );
}
