import { Button } from '@/components/ui/button';
import { SlidersHorizontal, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  countActiveFilters,
  type ApplicationFilterState,
} from '../lib/application-filters';
import type { ApplicationStatus } from '../types/ApplicationStatus';
import {
  ActiveFilterTags,
  DatePresets,
  DateRangeField,
  fieldLabel,
  SearchField,
  SortField,
  StatusChips,
  type FilterChange,
} from './filters/FilterControls';
import { MobileFilterSheet, SheetSection } from './filters/MobileFilterSheet';

interface Props {
  filters: ApplicationFilterState;
  /** Cards per status after search and date filters, shown on the status buttons. */
  statusCounts: Record<ApplicationStatus, number>;
  isMobile: boolean;
  visibleCount: number;
  totalCount: number;
  /** Cards on screen right now (one column on mobile); "Select visible" acts on these. */
  onScreenCount: number;
  allVisibleSelected: boolean;
  selectedCount: number;
  isDeletePending: boolean;
  deleteError?: string | null;
  onFiltersChange: FilterChange;
  onClearFilters: () => void;
  onToggleVisibleSelection: () => void;
  onDeleteSelected: () => void;
}

export function ApplicationFilters({
  filters,
  statusCounts,
  isMobile,
  visibleCount,
  totalCount,
  onScreenCount,
  allVisibleSelected,
  selectedCount,
  isDeletePending,
  deleteError,
  onFiltersChange,
  onClearFilters,
  onToggleVisibleSelection,
  onDeleteSelected,
}: Props) {
  const activeCount = countActiveFilters(filters);

  const search = (
    <SearchField
      value={filters.searchText}
      onChange={(searchText) => onFiltersChange({ searchText })}
    />
  );
  const sort = (
    <SortField
      value={filters.sortBy}
      onChange={(sortBy) => onFiltersChange({ sortBy })}
    />
  );
  const statusChips = (
    <StatusChips
      statuses={filters.statuses}
      counts={statusCounts}
      onChange={(statuses) => onFiltersChange({ statuses })}
    />
  );
  const datePresets = (
    <DatePresets filters={filters} onChange={onFiltersChange} />
  );
  const dateRange = (
    <DateRangeField filters={filters} onChange={onFiltersChange} />
  );

  return (
    <motion.section
      aria-label='Application filters'
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className='filters-card relative isolate grid gap-5 overflow-hidden rounded-2xl p-4 sm:p-5'
    >
      {/* Faint color glows in the corners, echoing the hero. */}
      <div aria-hidden='true' className='absolute inset-0 -z-10'>
        <span className='absolute -top-24 -left-16 size-56 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/15' />
        <span className='absolute -right-16 -bottom-28 size-64 rounded-full bg-fuchsia-200/40 blur-3xl dark:bg-fuchsia-500/10' />
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <span className='grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/30'>
            <SlidersHorizontal aria-hidden='true' className='size-5' />
          </span>
          <div>
            <p className='text-base font-semibold text-ink'>
              Filter applications
            </p>
            <p className='text-sm text-ink-muted'>
              Showing {visibleCount} of {totalCount}
            </p>
          </div>
        </div>
      </div>

      {isMobile ? (
        <div className='flex items-end gap-2'>
          <div className='min-w-0 flex-1'>{search}</div>
          <MobileFilterSheet
            activeCount={activeCount}
            resultCount={visibleCount}
            onClearAll={onClearFilters}
          >
            <SheetSection title='Status'>{statusChips}</SheetSection>
            <SheetSection title='Quick dates'>{datePresets}</SheetSection>
            {dateRange}
            {sort}
          </MobileFilterSheet>
        </div>
      ) : (
        <>
          <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_14rem] lg:items-end'>
            {search}
            {dateRange}
            {sort}
          </div>
          <div className='flex flex-wrap items-end justify-between gap-x-6 gap-y-3'>
            <div className='grid gap-2'>
              <span className={fieldLabel}>Status</span>
              {statusChips}
            </div>
            <div className='grid gap-2'>
              <span className={fieldLabel}>Quick dates</span>
              {datePresets}
            </div>
          </div>
        </>
      )}

      <div
        aria-hidden='true'
        className='h-px bg-linear-to-r from-transparent via-line-strong to-transparent'
      />

      {/* Desktop: tags on the left of the action buttons, in one row.
          Mobile: tags above the buttons. */}
      <div
        className={isMobile ? '' : 'flex items-center justify-between gap-4'}
      >
        <AnimatePresence initial={false}>
          {activeCount > 0 && (
            <motion.div
              key='active-filters'
              // Mobile collapses the height in one motion so the card shrinks once;
              // on desktop the buttons hold the row's height, so a fade is enough.
              {...(isMobile
                ? {
                    initial: { height: 0, opacity: 0 },
                    animate: { height: 'auto', opacity: 1 },
                    exit: { height: 0, opacity: 0 },
                  }
                : {
                    initial: { opacity: 0, x: -8 },
                    animate: { opacity: 1, x: 0 },
                    exit: { opacity: 0, x: -8 },
                  })}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className={isMobile ? '-mx-1 -mt-1 overflow-hidden' : 'min-w-0'}
            >
              <div
                className={`flex flex-wrap items-center gap-2 ${isMobile ? 'px-1 pt-1 pb-4' : ''}`}
              >
                <ActiveFilterTags
                  filters={filters}
                  onChange={onFiltersChange}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-accent-ink hover:bg-accent-soft hover:text-ink'
                  onClick={onClearFilters}
                >
                  <X aria-hidden='true' />
                  Clear all
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className='ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2'>
          {/* Announces the count to screen readers; the badge below is visual only. */}
          <span role='status' className='sr-only'>
            {selectedCount > 0 ? `${selectedCount} selected` : ''}
          </span>
          <Button
            type='button'
            variant='outline'
            className='h-9 rounded-xl px-3'
            disabled={onScreenCount === 0}
            onClick={onToggleVisibleSelection}
          >
            {/* Both labels share one grid cell, so the button keeps the
                width of the longer one and doesn't resize on toggle. */}
            <span className='grid'>
              <span
                className={`col-start-1 row-start-1 ${allVisibleSelected ? '' : 'invisible'}`}
                aria-hidden={!allVisibleSelected}
              >
                Deselect visible
              </span>
              <span
                className={`col-start-1 row-start-1 ${allVisibleSelected ? 'invisible' : ''}`}
                aria-hidden={allVisibleSelected}
              >
                Select visible
              </span>
            </span>
          </Button>
          <Button
            type='button'
            variant='destructive'
            className='relative h-9 rounded-xl px-3'
            disabled={selectedCount === 0 || isDeletePending}
            onClick={onDeleteSelected}
          >
            <Trash2 aria-hidden='true' />
            Delete selected
            {/* Count bubble on the corner, so it never takes space in the row. */}
            <AnimatePresence>
              {selectedCount > 0 && (
                <motion.span
                  key='selected-count'
                  aria-hidden='true'
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className='absolute -top-2 -right-2 grid h-5 min-w-5 place-items-center rounded-full bg-indigo-500 px-1.5 text-[0.7rem] font-semibold text-white tabular-nums shadow-md shadow-indigo-500/40 ring-2 ring-white dark:ring-slate-900'
                >
                  {/* Re-keyed on each change so the number gives a small bump. */}
                  <motion.span
                    key={selectedCount}
                    initial={{ scale: 1.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                  >
                    {selectedCount}
                  </motion.span>
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>

      {deleteError && (
        <p role='alert' className='text-sm text-destructive'>
          {deleteError}. Deleted cards were restored.
        </p>
      )}
    </motion.section>
  );
}
