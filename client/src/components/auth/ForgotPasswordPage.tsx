import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/auth';
import { AuthLayout, FormMessage } from './AuthLayout';
import { CheckInbox } from './CheckInbox';
import { FormField } from './FormField';
import { isCaptchaEnabled } from '../../lib/captcha';
import { TurnstileWidget } from './TurnstileWidget';

/** `/forgot-password`: emails a link to choose a new password. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const resetMutation = useMutation({
    mutationFn: requestPasswordReset,
    // A CAPTCHA token works once, so a failed attempt needs a new one.
    onError: () => setCaptchaResetKey((key) => key + 1),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMutation.mutate({ email, captchaToken });
  }

  return (
    <AuthLayout
      title='Forgot your password?'
      description="Enter your email and we'll send you a link to choose a new one."
      footer={<Link to='/login'>Back to log in</Link>}
    >
      {resetMutation.isSuccess ? (
        <CheckInbox email={resetMutation.variables.email.trim()} />
      ) : (
        <form className='grid gap-4' onSubmit={handleSubmit} noValidate>
          <FormField
            label='Email'
            type='email'
            autoComplete='email'
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TurnstileWidget
            onToken={setCaptchaToken}
            resetKey={captchaResetKey}
          />
          {resetMutation.isError && (
            <FormMessage tone='error'>{resetMutation.error.message}</FormMessage>
          )}
          <Button
            type='submit'
            size='lg'
            disabled={
              resetMutation.isPending || (isCaptchaEnabled && !captchaToken)
            }
          >
            {resetMutation.isPending ? 'Sending...' : 'Send link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
