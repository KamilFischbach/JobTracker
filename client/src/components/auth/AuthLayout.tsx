import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ThemeToggle';

/**
 * Centered card used by the login, sign-up and password pages.
 *
 * @param {object}    props
 * @param {string}    props.title        Page heading.
 * @param {ReactNode} props.description  Text under the heading.
 * @param {ReactNode} props.children     The form or message.
 * @param {ReactNode} props.footer       Links under the card.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className='relative flex min-h-svh w-full flex-col items-center justify-center px-4 py-12'>
      <ThemeToggle className='absolute top-4 right-4 sm:top-6 sm:right-6' />
      <div className='w-full max-w-sm'>
        <Link
          to='/'
          className='mb-6 block text-center text-sm font-semibold tracking-[0.2em] text-violet-700/80 uppercase no-underline dark:text-violet-300/80'
        >
          Job Tracker
        </Link>
        <section className='hero relative isolate overflow-hidden rounded-3xl border border-white/70 px-6 py-8 text-left shadow-sm dark:border-white/10'>
          <h1 className='m-0! text-2xl! font-semibold! text-ink!'>{title}</h1>
          {description && (
            <p className='mt-2 text-sm text-ink-muted'>{description}</p>
          )}
          <div className='mt-6'>{children}</div>
        </section>
        {footer && (
          <div className='mt-6 flex flex-col items-center gap-2 text-sm text-ink-muted'>
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Error or success message under a form, announced to screen readers.
 *
 * @param {object}    props
 * @param {'error' | 'success'} props.tone  Colors and ARIA role.
 * @param {ReactNode} props.children        The message.
 */
export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}) {
  return tone === 'error' ? (
    <p
      role='alert'
      className='rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
    >
      {children}
    </p>
  ) : (
    <p
      role='status'
      className='rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300'
    >
      {children}
    </p>
  );
}
