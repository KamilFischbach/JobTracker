import { Input } from '@/components/ui/input';
import {
  ArrowUpDown,
  CalendarRange,
  ChevronDown,
  Search,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId } from 'react';
import {
  DATE_PRESETS,
  EMPTY_FILTERS,
  getActiveDatePreset,
  getDatePresetRange,
  showsAllStatuses,
  toggleStatusFilter,
  type ApplicationFilterState,
} from '../../lib/application-filters';
import type { ApplicationSort } from '../../lib/application-list';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_META,
  type ApplicationStatus,
} from '../../types/ApplicationStatus';

export type FilterChange = (patch: Partial<ApplicationFilterState>) => void;

export const fieldLabel =
  'text-[0.7rem] font-semibold tracking-wider text-ink-muted uppercase';
// Shared look for the search box, date range and sort pickers.
// Glass at rest; brighter with a soft indigo glow when focused.
const fieldShell =
  'group flex h-10 items-center gap-2 rounded-xl border border-line bg-glass px-3 transition-all hover:border-line-strong focus-within:border-indigo-400/60 focus-within:bg-glass-hover focus-within:shadow-[0_0_0_4px_rgb(99_102_241/0.2)]';
const fieldIcon =
  'size-4 shrink-0 text-ink-subtle transition-colors group-focus-within:text-indigo-500';
const bareInput =
  'h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle';
const chipBase =
  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className='grid min-w-0 gap-1.5'>
      <label htmlFor={id} className={fieldLabel}>
        Search
      </label>
      <div className='group relative'>
        <Search
          aria-hidden='true'
          className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle transition-colors group-focus-within:text-indigo-500'
        />
        <Input
          id={id}
          type='search'
          // Fuller name for screen readers; starts with the visible label "Search".
          aria-label='Search company, title, or notes'
          value={value}
          placeholder='e.g. Acme or platform engineer'
          className='h-10 rounded-xl border-line bg-glass pr-9 pl-9 text-ink transition-all placeholder:text-ink-subtle hover:border-line-strong focus-visible:border-indigo-400/60 focus-visible:bg-glass-hover focus-visible:shadow-[0_0_0_4px_rgb(99_102_241/0.2)] dark:bg-glass dark:focus-visible:bg-glass-hover focus-visible:ring-0 [&::-webkit-search-cancel-button]:hidden'
          onChange={(e) => onChange(e.currentTarget.value)}
        />
        {value && (
          <button
            type='button'
            aria-label='Clear search'
            className='absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-line hover:text-ink focus-visible:outline-2 focus-visible:outline-ring'
            onClick={() => onChange('')}
          >
            <X aria-hidden='true' className='size-3.5' />
          </button>
        )}
      </div>
    </div>
  );
}

export function DateRangeField({
  filters,
  onChange,
}: {
  filters: ApplicationFilterState;
  onChange: FilterChange;
}) {
  const id = useId();
  return (
    <div
      role='group'
      aria-labelledby={`${id}-label`}
      className='grid min-w-0 gap-1.5'
    >
      <span id={`${id}-label`} className={fieldLabel}>
        Applied date
      </span>
      <div className={fieldShell}>
        <CalendarRange aria-hidden='true' className={fieldIcon} />
        <label htmlFor={`${id}-from`} className='sr-only'>
          Applied from
        </label>
        <input
          id={`${id}-from`}
          type='date'
          value={filters.appliedAfter}
          max={filters.appliedBefore || undefined}
          className={bareInput}
          onChange={(e) => onChange({ appliedAfter: e.currentTarget.value })}
        />
        <span aria-hidden='true' className='text-line-strong'>
          →
        </span>
        <label htmlFor={`${id}-to`} className='sr-only'>
          Applied through
        </label>
        <input
          id={`${id}-to`}
          type='date'
          value={filters.appliedBefore}
          min={filters.appliedAfter || undefined}
          className={bareInput}
          onChange={(e) => onChange({ appliedBefore: e.currentTarget.value })}
        />
      </div>
    </div>
  );
}

export function DatePresets({
  filters,
  onChange,
}: {
  filters: ApplicationFilterState;
  onChange: FilterChange;
}) {
  const activePreset = getActiveDatePreset(filters);
  return (
    <div
      role='group'
      aria-label='Quick dates'
      className='flex flex-wrap items-center gap-2'
    >
      {DATE_PRESETS.map(({ id, label }) => {
        const isActive = activePreset === id;
        return (
          <button
            key={id}
            type='button'
            aria-pressed={isActive}
            className={`${chipBase} ${isActive ? 'bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30' : 'bg-glass text-ink-muted ring-1 ring-line hover:bg-glass-hover hover:text-ink'}`}
            onClick={() =>
              onChange(
                isActive
                  ? { appliedAfter: '', appliedBefore: '' }
                  : getDatePresetRange(id),
              )
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SortField({
  value,
  onChange,
}: {
  value: ApplicationSort;
  onChange: (value: ApplicationSort) => void;
}) {
  const id = useId();
  return (
    <div className='grid min-w-0 gap-1.5'>
      <label htmlFor={id} className={fieldLabel}>
        Sort by
      </label>
      <div className={`relative ${fieldShell}`}>
        <ArrowUpDown aria-hidden='true' className={fieldIcon} />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value as ApplicationSort)}
          className={`${bareInput} cursor-pointer appearance-none pr-6`}
        >
          <option value='applied-newest'>Applied date: newest</option>
          <option value='applied-oldest'>Applied date: oldest</option>
          <option value='company'>Company name</option>
          <option value='salary-high'>Salary: highest first</option>
        </select>
        <ChevronDown
          aria-hidden='true'
          className='pointer-events-none absolute right-3 size-4 text-ink-subtle'
        />
      </div>
    </div>
  );
}

/**
 * Status filter buttons. With no filter every column shows; pressing a
 * status shows only the pressed ones.
 */
export function StatusChips({
  statuses,
  counts,
  onChange,
}: {
  statuses: ApplicationStatus[];
  counts: Record<ApplicationStatus, number>;
  onChange: (statuses: ApplicationStatus[]) => void;
}) {
  const isFiltering = !showsAllStatuses({ statuses });
  return (
    <div
      role='group'
      aria-label='Show only these statuses'
      className='flex flex-wrap items-center gap-2'
    >
      {APPLICATION_STATUSES.map((status) => {
        const meta = APPLICATION_STATUS_META[status];
        const isPressed = isFiltering && statuses.includes(status);
        // While filtering, statuses that are left out are dimmed.
        const isDimmed = isFiltering && !isPressed;
        return (
          <button
            key={status}
            type='button'
            aria-pressed={isPressed}
            aria-label={`${meta.label} (${counts[status]})`}
            className={`${chipBase} ${
              isPressed
                ? `${meta.className} shadow-sm ring-1 ring-black/10`
                : isDimmed
                  ? 'bg-transparent text-ink-subtle ring-1 ring-line hover:text-ink-muted'
                  : 'bg-glass text-ink ring-1 ring-line hover:bg-glass-hover'
            }`}
            onClick={() => onChange(toggleStatusFilter(statuses, status))}
          >
            <span
              aria-hidden='true'
              className={`size-2 rounded-full ${isDimmed ? 'bg-line-strong' : meta.swatch}`}
            />
            {meta.label}
            <span className='tabular-nums opacity-70'>{counts[status]}</span>
          </button>
        );
      })}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

/** Small removable tags describing each active filter. */
export function ActiveFilterTags({
  filters,
  onChange,
}: {
  filters: ApplicationFilterState;
  onChange: FilterChange;
}) {
  const tags: { key: string; label: string; clear: () => void }[] = [];
  const searchText = filters.searchText.trim();
  if (searchText) {
    tags.push({
      key: 'search',
      label: `“${searchText}”`,
      clear: () => onChange({ searchText: '' }),
    });
  }
  const preset = getActiveDatePreset(filters);
  if (preset) {
    tags.push({
      key: 'dates',
      label: DATE_PRESETS.find(({ id }) => id === preset)!.label,
      clear: () => onChange({ appliedAfter: '', appliedBefore: '' }),
    });
  } else {
    if (filters.appliedAfter) {
      tags.push({
        key: 'from',
        label: `From ${formatDate(filters.appliedAfter)}`,
        clear: () => onChange({ appliedAfter: '' }),
      });
    }
    if (filters.appliedBefore) {
      tags.push({
        key: 'to',
        label: `Through ${formatDate(filters.appliedBefore)}`,
        clear: () => onChange({ appliedBefore: '' }),
      });
    }
  }
  if (!showsAllStatuses(filters)) {
    tags.push({
      key: 'statuses',
      label: `Status: ${filters.statuses.map((status) => APPLICATION_STATUS_META[status].label).join(', ')}`,
      clear: () => onChange({ statuses: EMPTY_FILTERS.statuses }),
    });
  }

  return (
    <ul
      aria-label='Active filters'
      className='flex flex-wrap items-center gap-2'
    >
      <AnimatePresence initial={false}>
        {tags.map((tag) => (
          <motion.li
            key={tag.key}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className='inline-flex max-w-full items-center gap-1 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-xs font-medium text-accent-ink ring-1 ring-accent-line'
          >
            <span className='truncate'>{tag.label}</span>
            <button
              type='button'
              aria-label={`Remove filter: ${tag.label}`}
              className='grid size-5 shrink-0 place-items-center rounded-full text-accent-ink transition-colors hover:bg-accent-line hover:text-ink focus-visible:outline-2 focus-visible:outline-ring'
              onClick={tag.clear}
            >
              <X aria-hidden='true' className='size-3' />
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
