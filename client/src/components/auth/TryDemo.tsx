import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionCache } from '../../hooks/useCurrentUser';
import { isCaptchaEnabled } from '../../lib/captcha';
import { startDemo } from '../../services/auth';
import { FormMessage } from './AuthLayout';
import { TurnstileWidget } from './TurnstileWidget';

/**
 * "Try the demo" button: starts a temporary account with sample
 * applications, deleted after 24 hours.
 */
export function TryDemo() {
  const navigate = useNavigate();
  const { setLoggedIn } = useSessionCache();
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const demoMutation = useMutation({
    mutationFn: startDemo,
    onSuccess: (user) => {
      setLoggedIn(user);
      navigate('/applications', { replace: true });
    },
    // A CAPTCHA token works once, so a failed attempt needs a new one.
    onError: () => setCaptchaResetKey((key) => key + 1),
  });

  return (
    <section aria-label='Demo' className='grid gap-3'>
      <div className='flex items-center gap-3 text-xs text-ink-subtle'>
        <span className='h-px flex-1 bg-line' />
        or
        <span className='h-px flex-1 bg-line' />
      </div>
      <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />
      {demoMutation.isError && (
        <FormMessage tone='error'>{demoMutation.error.message}</FormMessage>
      )}
      <Button
        type='button'
        variant='outline'
        size='lg'
        disabled={demoMutation.isPending || (isCaptchaEnabled && !captchaToken)}
        onClick={() => demoMutation.mutate(captchaToken)}
      >
        <PlayCircle aria-hidden='true' />
        {demoMutation.isPending ? 'Preparing the demo...' : 'Try the demo'}
      </Button>
      <p className='text-center text-xs text-ink-subtle'>
        No sign-up. Sample applications, deleted after 24 hours.
      </p>
    </section>
  );
}
