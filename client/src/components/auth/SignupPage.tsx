import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { newPasswordProblem } from '../../lib/password-rules';
import { signup } from '../../services/auth';
import { AuthLayout, FormMessage } from './AuthLayout';
import { CheckInbox } from './CheckInbox';
import { FormField } from './FormField';
import { isCaptchaEnabled } from '../../lib/captcha';
import { TurnstileWidget } from './TurnstileWidget';

/** `/signup`: emails a confirmation link; the account exists once it is opened. */
export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  const signupMutation = useMutation({
    mutationFn: signup,
    // A CAPTCHA token works once, so a failed attempt needs a new one.
    onError: () => setCaptchaResetKey((key) => key + 1),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = newPasswordProblem(password, confirmation);
    setProblem(found);
    if (found) return;
    signupMutation.mutate({ email, password, captchaToken });
  }

  const error = problem ?? (signupMutation.isError ? signupMutation.error.message : null);
  const waitingForCaptcha = isCaptchaEnabled && !captchaToken;

  return (
    <AuthLayout
      title='Create an account'
      description='Track every application in one place. Free.'
      footer={
        <p>
          Already have an account? <Link to='/login'>Log in</Link>
        </p>
      }
    >
      {signupMutation.isSuccess ? (
        <CheckInbox email={signupMutation.variables.email.trim()} />
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
          <FormField
            label='Password'
            type='password'
            autoComplete='new-password'
            required
            aria-describedby='password-hint'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id='password-hint' className='-mt-2 text-xs text-ink-subtle'>
            At least 12 characters. A few random words work well.
          </p>
          <FormField
            label='Repeat password'
            type='password'
            autoComplete='new-password'
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />
          {error && <FormMessage tone='error'>{error}</FormMessage>}
          <Button
            type='submit'
            size='lg'
            disabled={signupMutation.isPending || waitingForCaptcha}
          >
            {signupMutation.isPending ? 'Sending...' : 'Create account'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
