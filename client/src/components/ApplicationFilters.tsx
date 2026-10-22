import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ApplicationSort } from '../lib/application-list';

interface Props {
  searchText: string;
  appliedAfter: string;
  appliedBefore: string;
  sortBy: ApplicationSort;
  visibleCount: number;
  totalCount: number;
  allVisibleSelected: boolean;
  hasSelectedIds: boolean;
  isDeletePending: boolean;
  deleteError?: string | null;
  onSearchChange: (val: string) => void;
  onAppliedAfterChange: (val: string) => void;
  onAppliedBeforeChange: (val: string) => void;
  onSortByChange: (val: ApplicationSort) => void;
  onToggleVisibleSelection: () => void;
  onDeleteSelected: () => void;
}

export function ApplicationFilters({
  searchText,
  appliedAfter,
  appliedBefore,
  sortBy,
  visibleCount,
  totalCount,
  allVisibleSelected,
  hasSelectedIds,
  isDeletePending,
  deleteError,
  onSearchChange,
  onAppliedAfterChange,
  onAppliedBeforeChange,
  onSortByChange,
  onToggleVisibleSelection,
  onDeleteSelected,
}: Props) {
  return (
    <section aria-label='Application filters' className='grid gap-3'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem_auto_auto] xl:items-end'>
        <label className='grid min-w-0 gap-1 text-sm'>
          Search company, title, or notes
          <Input
            type='search'
            value={searchText}
            placeholder='e.g. Acme or platform engineer'
            onChange={(e) => onSearchChange(e.currentTarget.value)}
          />
        </label>
        <label className='grid min-w-0 gap-1 text-sm'>
          Applied from
          <Input
            type='date'
            value={appliedAfter}
            onChange={(e) => onAppliedAfterChange(e.currentTarget.value)}
          />
        </label>
        <label className='grid min-w-0 gap-1 text-sm'>
          Applied through
          <Input
            type='date'
            value={appliedBefore}
            onChange={(e) => onAppliedBeforeChange(e.currentTarget.value)}
          />
        </label>
        <label className='grid min-w-0 gap-1 text-sm'>
          Sort by
          <select
            value={sortBy}
            onChange={(e) =>
              onSortByChange(e.currentTarget.value as ApplicationSort)
            }
            className='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
          >
            <option value='applied-newest'>Applied date: newest</option>
            <option value='applied-oldest'>Applied date: oldest</option>
            <option value='company'>Company name</option>
            <option value='salary-high'>Salary: highest first</option>
          </select>
        </label>
        <Button
          type='button'
          variant='outline'
          className='w-full justify-center whitespace-nowrap sm:w-36'
          disabled={visibleCount === 0}
          onClick={onToggleVisibleSelection}
        >
          {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
        </Button>
        <Button
          type='button'
          variant='destructive'
          className='w-full justify-center whitespace-nowrap xl:w-auto'
          disabled={!hasSelectedIds || isDeletePending}
          onClick={onDeleteSelected}
        >
          Delete selected
        </Button>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          Showing {visibleCount} of {totalCount}
        </p>
        {deleteError && (
          <p role='alert' className='text-sm text-destructive'>
            {deleteError}. Deleted cards were restored.
          </p>
        )}
      </div>
    </section>
  );
}
