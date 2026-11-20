import { MailCheck } from 'lucide-react';

/**
 * Shown after a form that sends an email. The text does not say whether the
 * address has an account (the server does not reveal it either).
 *
 * @param {object} props
 * @param {string} props.email  Address the email went to.
 */
export function CheckInbox({ email }: { email: string }) {
  return (
    <div role='status' className='flex flex-col items-center gap-3 text-center'>
      <span className='grid size-12 place-items-center rounded-full bg-accent-soft text-accent-ink'>
        <MailCheck aria-hidden='true' className='size-6' />
      </span>
      <p className='text-base font-semibold text-ink'>Check your inbox</p>
      <p className='text-sm text-ink-muted'>
        We sent an email to <strong className='text-ink'>{email}</strong>.
        Open the link in it to continue. It can take a minute; check the spam
        folder too.
      </p>
    </div>
  );
}
