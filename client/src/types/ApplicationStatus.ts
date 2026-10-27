export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'INTERVIEW_SCHEDULED',
  'OFFER',
  'REJECTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

type StatusMeta = {
  label: string;
  /** Badge colors. */
  className: string;
  /** Gradient bar at the top of the column. */
  bar: string;
  /** Column background tint. */
  column: string;
  /** Column glow while a card is dragged over it. */
  over: string;
  /** Small dot next to the column title. */
  dot: string;
  /** Plain color dot, e.g. in menus. */
  swatch: string;
  /** Card count pill. */
  count: string;
  /** Colored left edge on cards. */
  cardEdge: string;
};

// Full class names are spelled out so Tailwind can find them.
export const APPLICATION_STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  SAVED: {
    label: 'Saved',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300',
    bar: 'from-slate-400 to-slate-600',
    column:
      'bg-slate-50 border-slate-200 dark:bg-white/[0.03] dark:border-white/10',
    over: 'ring-slate-400 shadow-slate-400/40',
    dot: 'bg-slate-400 ring-4 ring-slate-400/20',
    swatch: 'bg-slate-400',
    count:
      'bg-slate-200 text-slate-700 dark:bg-slate-400/20 dark:text-slate-200',
    cardEdge: 'border-l-slate-400',
  },
  APPLIED: {
    label: 'Applied',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    bar: 'from-sky-400 to-blue-600',
    column:
      'bg-sky-50 border-sky-200 dark:bg-sky-500/[0.06] dark:border-sky-400/15',
    over: 'ring-sky-400 shadow-sky-400/40',
    dot: 'bg-sky-500 ring-4 ring-sky-500/20',
    swatch: 'bg-sky-500',
    count: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
    cardEdge: 'border-l-sky-500',
  },
  INTERVIEW_SCHEDULED: {
    label: 'Interview',
    className:
      'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
    bar: 'from-violet-400 to-fuchsia-600',
    column:
      'bg-violet-50 border-violet-200 dark:bg-violet-500/[0.06] dark:border-violet-400/15',
    over: 'ring-violet-400 shadow-violet-400/40',
    dot: 'bg-violet-500 ring-4 ring-violet-500/20',
    swatch: 'bg-violet-500',
    count:
      'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
    cardEdge: 'border-l-violet-500',
  },
  OFFER: {
    label: 'Offer',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'from-emerald-400 to-teal-600',
    column:
      'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/[0.06] dark:border-emerald-400/15',
    over: 'ring-emerald-400 shadow-emerald-400/40',
    dot: 'bg-emerald-500 ring-4 ring-emerald-500/20',
    swatch: 'bg-emerald-500',
    count:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    cardEdge: 'border-l-emerald-500',
  },
  REJECTED: {
    label: 'Rejected',
    className:
      'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    bar: 'from-rose-400 to-pink-600',
    column:
      'bg-rose-50 border-rose-200 dark:bg-rose-500/[0.06] dark:border-rose-400/15',
    over: 'ring-rose-400 shadow-rose-400/40',
    dot: 'bg-rose-500 ring-4 ring-rose-500/20',
    swatch: 'bg-rose-500',
    count: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
    cardEdge: 'border-l-rose-500',
  },
};
