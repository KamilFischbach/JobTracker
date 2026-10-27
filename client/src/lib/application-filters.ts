import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';
import { dateInputValue, type ApplicationSort } from './application-list';

export type ApplicationFilterState = {
  searchText: string;
  /** yyyy-mm-dd or '' */
  appliedAfter: string;
  /** yyyy-mm-dd or '' */
  appliedBefore: string;
  sortBy: ApplicationSort;
  /** Statuses whose columns are shown, in board order. */
  statuses: ApplicationStatus[];
};

export const DEFAULT_SORT: ApplicationSort = 'applied-newest';

const SORT_OPTIONS: ApplicationSort[] = [
  'applied-newest',
  'applied-oldest',
  'company',
  'salary-high',
];

// Short, readable names for statuses in the URL (e.g. ?status=applied,offer).
const STATUS_SLUGS: Record<ApplicationStatus, string> = {
  SAVED: 'saved',
  APPLIED: 'applied',
  INTERVIEW_SCHEDULED: 'interview',
  OFFER: 'offer',
  REJECTED: 'rejected',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const EMPTY_FILTERS: Omit<ApplicationFilterState, 'sortBy'> = {
  searchText: '',
  appliedAfter: '',
  appliedBefore: '',
  statuses: [...APPLICATION_STATUSES],
};

/** Reads filters from the URL, ignoring anything invalid. */
export function parseFilterParams(
  params: URLSearchParams,
): ApplicationFilterState {
  const date = (key: string) => {
    const value = params.get(key) ?? '';
    return DATE_PATTERN.test(value) ? value : '';
  };
  const sort = params.get('sort') as ApplicationSort | null;
  const statusSlugs = params.get('status')?.split(',') ?? [];
  const statuses = APPLICATION_STATUSES.filter((status) =>
    statusSlugs.includes(STATUS_SLUGS[status]),
  );

  return {
    searchText: params.get('q') ?? '',
    appliedAfter: date('from'),
    appliedBefore: date('to'),
    sortBy: sort && SORT_OPTIONS.includes(sort) ? sort : DEFAULT_SORT,
    // No (valid) status param means every status is shown.
    statuses: statuses.length > 0 ? statuses : [...APPLICATION_STATUSES],
  };
}

/** Writes filters to URL params, leaving out anything at its default. */
export function toFilterParams(
  filters: ApplicationFilterState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.searchText) params.set('q', filters.searchText);
  if (filters.appliedAfter) params.set('from', filters.appliedAfter);
  if (filters.appliedBefore) params.set('to', filters.appliedBefore);
  if (filters.sortBy !== DEFAULT_SORT) params.set('sort', filters.sortBy);
  if (!showsAllStatuses(filters)) {
    params.set(
      'status',
      APPLICATION_STATUSES.filter((status) => filters.statuses.includes(status))
        .map((status) => STATUS_SLUGS[status])
        .join(','),
    );
  }
  return params;
}

/**
 * Next statuses after pressing a status button. With no filter, pressing one
 * shows only that status; later presses add or remove statuses, and removing
 * the last one goes back to showing everything.
 */
export function toggleStatusFilter(
  statuses: ApplicationStatus[],
  status: ApplicationStatus,
): ApplicationStatus[] {
  if (showsAllStatuses({ statuses })) return [status];
  if (statuses.includes(status)) {
    const remaining = statuses.filter((item) => item !== status);
    return remaining.length > 0 ? remaining : [...APPLICATION_STATUSES];
  }
  return APPLICATION_STATUSES.filter(
    (item) => item === status || statuses.includes(item),
  );
}

export function showsAllStatuses(
  filters: Pick<ApplicationFilterState, 'statuses'>,
) {
  return APPLICATION_STATUSES.every((status) =>
    filters.statuses.includes(status),
  );
}

/** Number of active filters, as shown on the mobile "Filters" button. Sort is not a filter. */
export function countActiveFilters(filters: ApplicationFilterState): number {
  return [
    filters.searchText.trim() !== '',
    filters.appliedAfter !== '' || filters.appliedBefore !== '',
    !showsAllStatuses(filters),
  ].filter(Boolean).length;
}

export function countByStatus(
  applications: JobApplicationType[],
): Record<ApplicationStatus, number> {
  const counts = Object.fromEntries(
    APPLICATION_STATUSES.map((status) => [status, 0]),
  ) as Record<ApplicationStatus, number>;
  applications.forEach((application) => {
    counts[application.status] += 1;
  });
  return counts;
}

export type DatePreset = 'last-7-days' | 'last-30-days' | 'this-month';

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'last-7-days', label: 'Last 7 days' },
  { id: 'last-30-days', label: 'Last 30 days' },
  { id: 'this-month', label: 'This month' },
];

/** Date range for a quick-date button, ending today. */
export function getDatePresetRange(
  preset: DatePreset,
  today: Date = new Date(),
): { appliedAfter: string; appliedBefore: string } {
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (preset === 'last-7-days') start.setDate(start.getDate() - 6);
  if (preset === 'last-30-days') start.setDate(start.getDate() - 29);
  if (preset === 'this-month') start.setDate(1);
  return {
    appliedAfter: dateInputValue(start),
    appliedBefore: dateInputValue(today),
  };
}

/** The quick-date button matching the current range, if any. */
export function getActiveDatePreset(
  filters: Pick<ApplicationFilterState, 'appliedAfter' | 'appliedBefore'>,
  today: Date = new Date(),
): DatePreset | null {
  const match = DATE_PRESETS.find(({ id }) => {
    const range = getDatePresetRange(id, today);
    return (
      range.appliedAfter === filters.appliedAfter &&
      range.appliedBefore === filters.appliedBefore
    );
  });
  return match?.id ?? null;
}
