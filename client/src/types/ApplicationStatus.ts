export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'INTERVIEW_SCHEDULED',
  'OFFER',
  'REJECTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  SAVED: { label: 'Saved', className: 'bg-slate-100 text-slate-700' },
  APPLIED: { label: 'Applied', className: 'bg-sky-100 text-sky-800' },
  INTERVIEW_SCHEDULED: {
    label: 'Interview',
    className: 'bg-amber-100 text-amber-900',
  },
  OFFER: { label: 'Offer', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-100 text-rose-800' },
};
