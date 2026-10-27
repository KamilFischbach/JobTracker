import {
  Briefcase,
  CalendarClock,
  MessagesSquare,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { getApplicationStats } from '../lib/application-stats';
import type { JobApplicationType } from '../types/JobApplication';
import { ApplicationFormDialog } from './ApplicationFormDialog';
import { CountUp } from './CountUp';
import { ThemeToggle } from './ThemeToggle';

type StatCard = {
  label: string;
  value: number | null;
  suffix?: string;
  caption: string;
  icon: LucideIcon;
  tone: string;
};

const listVariants: Variants = {
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 26 },
  },
};

function buildStatCards(applications: JobApplicationType[]): StatCard[] {
  const stats = getApplicationStats(applications);
  return [
    {
      label: 'Applications',
      value: stats.total,
      caption: `${stats.sent} sent so far`,
      icon: Briefcase,
      tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    },
    {
      label: 'Response rate',
      value: stats.responseRate,
      suffix: '%',
      caption:
        stats.sent === 0
          ? 'Nothing sent yet'
          : `${stats.responses} of ${stats.sent} answered`,
      icon: MessagesSquare,
      tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    },
    {
      label: 'Interviews',
      value: stats.interviews,
      caption: 'Scheduled',
      icon: CalendarClock,
      tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    },
    {
      label: 'Offers',
      value: stats.offers,
      caption: stats.offers > 0 ? 'Nice work!' : 'Keep going',
      icon: Trophy,
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    },
  ];
}

export function HeroHeader({
  applications,
  isDemoMode,
}: {
  /** Undefined while loading; the numbers show placeholders until then. */
  applications: JobApplicationType[] | undefined;
  isDemoMode: boolean;
}) {
  const cards = buildStatCards(applications ?? []);
  const isLoading = applications === undefined;

  return (
    <header className='hero relative isolate overflow-hidden rounded-3xl border border-white/70 px-5 dark:border-white/10 py-8 shadow-sm sm:px-8 sm:py-10'>
      {/* Slowly drifting color blobs behind the content. */}
      <div aria-hidden='true' className='absolute inset-0 -z-10'>
        <span className='hero-blob' />
        <span className='hero-blob' />
        <span className='hero-blob' />
      </div>

      <ThemeToggle className='absolute top-4 right-4 sm:top-6 sm:right-6' />

      <div className='flex flex-wrap items-end justify-between gap-6'>
        <div>
          {/* Right padding keeps the demo pill clear of the theme switch. */}
          <div className='flex flex-wrap items-center gap-2 pr-12'>
            {isDemoMode && (
              <span className='rounded-full bg-glass px-2.5 py-0.5 text-xs text-indigo-950/70 ring-1 ring-line backdrop-blur dark:text-indigo-200/80'>
                Demo mode: sample data saved in this browser
              </span>
            )}
          </div>
          <h1 className='m-0! mt-2! bg-linear-to-r from-indigo-950 via-violet-800 to-fuchsia-700 dark:from-white dark:via-indigo-200 dark:to-fuchsia-300 bg-clip-text pb-2 leading-[1.1] font-semibold! text-transparent!'>
            Applications
          </h1>
          <p className='mt-1 max-w-md text-sm text-ink-muted'>
            Every job you are chasing, from saved to signed.
          </p>
        </div>
        <ApplicationFormDialog />
      </div>

      <motion.ul
        aria-label='Application stats'
        className='mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4'
        initial='hidden'
        animate='show'
        variants={listVariants}
      >
        {cards.map(({ label, value, suffix, caption, icon: Icon, tone }) => (
          <motion.li
            key={label}
            variants={cardVariants}
            className='flex flex-col gap-3 rounded-2xl bg-glass p-4 shadow-lg shadow-indigo-950/5 ring-1 ring-line backdrop-blur-md transition-colors hover:bg-glass-hover dark:shadow-black/20'
          >
            <div className='flex items-center justify-between gap-2'>
              <p className='text-sm font-medium text-ink-muted'>{label}</p>
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}
              >
                <Icon aria-hidden='true' className='size-4' />
              </span>
            </div>
            <p className='text-3xl font-semibold tracking-tight text-ink tabular-nums sm:text-4xl'>
              {isLoading ? (
                <span className='inline-block h-9 w-16 animate-pulse rounded-md bg-line' />
              ) : value === null ? (
                '—'
              ) : (
                <CountUp value={value} suffix={suffix} />
              )}
            </p>
            <p className='text-xs text-ink-subtle'>
              {isLoading ? ' ' : caption}
            </p>
          </motion.li>
        ))}
      </motion.ul>
    </header>
  );
}
