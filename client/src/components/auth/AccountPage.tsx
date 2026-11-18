import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useSessionCache } from '../../hooks/useCurrentUser';
import { newPasswordProblem } from '../../lib/password-rules';
import { changePassword, deleteAccount, logout } from '../../services/auth';
import { FormMessage } from './AuthLayout';
import { FormField } from './FormField';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className='rounded-2xl bg-glass p-5 ring-1 ring-line sm:p-6'>
      <h2 className='m-0! text-lg! font-semibold! text-ink!'>{title}</h2>
      <p className='mt-1 text-sm text-ink-muted'>{description}</p>
      <div className='mt-5'>{children}</div>
    </section>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = newPasswordProblem(newPassword, confirmation);
    setProblem(found);
    changeMutation.reset();
    if (!found) changeMutation.mutate({ currentPassword, newPassword });
  }

  const error =
    problem ?? (changeMutation.isError ? changeMutation.error.message : null);

  return (
    <form className='grid max-w-sm gap-4' onSubmit={handleSubmit} noValidate>
      <FormField
        label='Current password'
        type='password'
        autoComplete='current-password'
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <FormField
        label='New password'
        type='password'
        autoComplete='new-password'
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <FormField
        label='Repeat new password'
        type='password'
        autoComplete='new-password'
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      {error && <FormMessage tone='error'>{error}</FormMessage>}
      {changeMutation.isSuccess && (
        <FormMessage tone='success'>
          Password changed. Other devices were logged out.
        </FormMessage>
      )}
      <Button
        type='submit'
        className='justify-self-start'
        disabled={changeMutation.isPending}
      >
        {changeMutation.isPending ? 'Saving...' : 'Change password'}
      </Button>
    </form>
  );
}

function DeleteAccountForm() {
  const { setLoggedOut } = useSessionCache();
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () =>
      setLoggedOut('Your account and all its data were deleted.'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    deleteMutation.mutate(password);
  }

  if (!confirming) {
    return (
      <Button
        type='button'
        variant='destructive'
        onClick={() => setConfirming(true)}
      >
        Delete my account
      </Button>
    );
  }

  return (
    <form className='grid max-w-sm gap-4' onSubmit={handleSubmit} noValidate>
      <FormField
        label='Password'
        type='password'
        autoComplete='current-password'
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {deleteMutation.isError && (
        <FormMessage tone='error'>{deleteMutation.error.message}</FormMessage>
      )}
      <div className='flex flex-wrap gap-2'>
        <Button
          type='submit'
          variant='destructive'
          disabled={!password || deleteMutation.isPending}
        >
          {deleteMutation.isPending
            ? 'Deleting...'
            : 'Delete account permanently'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => {
            setConfirming(false);
            setPassword('');
            deleteMutation.reset();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** `/account`: password change, log out, account deletion. */
export function AccountPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { setLoggedOut } = useSessionCache();

  const logoutMutation = useMutation({
    mutationFn: logout,
    // Forget the session locally even if the request failed.
    onSettled: () => setLoggedOut(),
  });

  return (
    <main className='mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 text-left sm:px-6'>
      <header className='flex flex-col items-start justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-center'>
        <div>
          <h1 className='m-0! text-2xl! font-semibold! text-ink!'>Account</h1>
          <p className='mt-1 text-sm text-ink-muted'>
            {user?.isDemo ? 'Demo account' : user?.email}
          </p>
        </div>
        <div className='flex w-full gap-2 sm:w-auto'>
          <Button
            variant='outline'
            className='flex-1 sm:flex-none'
            onClick={() => navigate('/applications')}
          >
            Back to applications
          </Button>
          <Button
            variant='outline'
            className='flex-1 sm:flex-none'
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            Log out
          </Button>
        </div>
      </header>

      {user?.isDemo ? (
        <FormMessage tone='success'>
          This is a temporary demo account. Its data is deleted after 24
          hours. Create a free account to keep your applications.
        </FormMessage>
      ) : (
        <>
          <Section
            title='Password'
            description='Changing it logs you out on every other device.'
          >
            <ChangePasswordForm />
          </Section>
          <Section
            title='Delete account'
            description='Deletes your account and every application in it. This cannot be undone.'
          >
            <DeleteAccountForm />
          </Section>
        </>
      )}
    </main>
  );
}
