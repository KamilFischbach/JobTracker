import { Button } from '@/components/ui/button';
import type { DragEndEvent } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useApplicationFilters } from '../hooks/useApplicationFilters';
import {
  countByStatus,
  EMPTY_FILTERS,
  type ApplicationFilterState,
} from '../lib/application-filters';
import { filterAndSortApplications } from '../lib/application-list';
import { celebrate } from '../lib/celebrate';
import { COLUMN_CARD_LIMIT, getShownCards } from '../lib/column-cards';
import {
  deleteApplications,
  getApplications,
  isDemoMode,
  updateApplicationStatus,
} from '../services/applications';
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';
import { ApplicationFilters } from './ApplicationFilters';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { HeroHeader } from './HeroHeader';
import { KanbanBoard } from './KanbanBoard';

const applicationsQueryKey = ['applications'] as const;

function NoResults({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-glass px-6 py-14 text-center'
    >
      <span className='grid size-12 place-items-center rounded-full bg-accent-soft text-accent-ink'>
        <SearchX aria-hidden='true' className='size-6' />
      </span>
      <p className='text-base font-semibold text-ink'>
        No applications match your filters
      </p>
      <p className='max-w-sm text-sm text-ink-muted'>
        Try a different search, widen the date range, or show more statuses.
      </p>
      <Button type='button' className='mt-2' onClick={onClearFilters}>
        Clear filters
      </Button>
    </motion.div>
  );
}

export function ApplicationsPage() {
  const queryClient = useQueryClient();
  const { filters, updateFilters } = useApplicationFilters();
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 639px)').matches,
  );
  const [mobileStatus, setMobileStatus] = useState<ApplicationStatus>('SAVED');
  // Columns opened with "Show more" (kept for this visit).
  const [expandedStatuses, setExpandedStatuses] = useState<
    Set<ApplicationStatus>
  >(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data: applications,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: applicationsQueryKey,
    queryFn: getApplications,
    // used for n8n email automation which
    // can change statuses at any time.
    refetchInterval: isDemoMode ? false : 30_000,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const updateMobileLayout = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateMobileLayout);
    return () => mediaQuery.removeEventListener('change', updateMobileLayout);
  }, []);

  const statusMutation = useMutation({
    mutationFn: updateApplicationStatus,
    onMutate: async ({ id, status }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: applicationsQueryKey }),
        queryClient.cancelQueries({ queryKey: ['applications', id] }),
      ]);
      const previousApplications =
        queryClient.getQueryData<JobApplicationType[]>(applicationsQueryKey);
      const previousApplication = queryClient.getQueryData<JobApplicationType>([
        'applications',
        id,
      ]);

      if (previousApplications) {
        queryClient.setQueryData<JobApplicationType[]>(
          applicationsQueryKey,
          (current) =>
            current?.map((app) => (app.id === id ? { ...app, status } : app)),
        );
      }
      if (previousApplication) {
        queryClient.setQueryData<JobApplicationType>(['applications', id], {
          ...previousApplication,
          status,
        });
      }
      return { previousApplications, previousApplication };
    },
    onError: (_error, { id }, context) => {
      if (context?.previousApplications)
        queryClient.setQueryData(
          applicationsQueryKey,
          context.previousApplications,
        );
      if (context?.previousApplication)
        queryClient.setQueryData(
          ['applications', id],
          context.previousApplication,
        );
      if (isMobile && context?.previousApplication) {
        setMobileStatus(context.previousApplication.status);
      }
    },
    onSettled: async (_data, _error, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['applications', id] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApplications,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: applicationsQueryKey });
      const previousApplications =
        queryClient.getQueryData<JobApplicationType[]>(applicationsQueryKey);
      queryClient.setQueryData<JobApplicationType[]>(
        applicationsQueryKey,
        (current) => current?.filter((app) => !ids.includes(app.id)),
      );
      return { previousApplications };
    },
    onError: (_error, _ids, context) => {
      if (context?.previousApplications)
        queryClient.setQueryData(
          applicationsQueryKey,
          context.previousApplications,
        );
    },
    onSuccess: (_result, ids) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationsQueryKey });
    },
  });

  // Search and dates first, so the status buttons can show how many cards each would add.
  const matchingApplications = filterAndSortApplications(
    applications ?? [],
    filters,
  );
  const statusCounts = countByStatus(matchingApplications);
  const visibleApplications = matchingApplications.filter((app) =>
    filters.statuses.includes(app.status),
  );
  // If the mobile column was hidden by the status filter, fall back to the first shown one.
  const shownMobileStatus = filters.statuses.includes(mobileStatus)
    ? mobileStatus
    : filters.statuses[0];
  // While searching or filtering by date, every match shows; nothing hides behind "Show more".
  const showAllCards = Boolean(
    filters.searchText.trim() || filters.appliedAfter || filters.appliedBefore,
  );
  // Cards the user can actually see: on mobile only one column is shown, and
  // collapsed columns only show their first few cards.
  const onScreenApplications = (
    isMobile ? [shownMobileStatus] : filters.statuses
  ).flatMap((status) =>
    getShownCards(
      visibleApplications.filter((app) => app.status === status),
      { expanded: expandedStatuses.has(status), showAll: showAllCards },
    ),
  );
  const allVisibleSelected =
    onScreenApplications.length > 0 &&
    onScreenApplications.every((app) => selectedIds.has(app.id));

  function toggleExpanded(status: ApplicationStatus) {
    setExpandedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  // If a moved card would land below the "Show more" cut-off, open that column
  // so the card doesn't seem to disappear.
  function revealMovedCard(id: string, status: ApplicationStatus) {
    if (showAllCards) return;
    const column = visibleApplications
      .map((app) => (app.id === id ? { ...app, status } : app))
      .filter((app) => app.status === status);
    if (column.findIndex((app) => app.id === id) >= COLUMN_CARD_LIMIT) {
      setExpandedStatuses((current) => new Set(current).add(status));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || typeof over.id !== 'string') return;
    const directStatus = APPLICATION_STATUSES.find((s) => s === over.id);
    const app = applications?.find((item) => item.id === String(active.id));
    const overApp = applications?.find((item) => item.id === String(over.id));
    const nextStatus = directStatus ?? overApp?.status;

    if (!nextStatus || !app || app.status === nextStatus) return;
    statusMutation.reset();
    if (nextStatus === 'OFFER') celebrate();
    revealMovedCard(app.id, nextStatus);
    statusMutation.mutate({ id: app.id, status: nextStatus });
  }

  function changeApplicationStatus(id: string, status: ApplicationStatus) {
    statusMutation.reset();
    if (status === 'OFFER') celebrate();
    revealMovedCard(id, status);
    // Follow the card to its new column, unless that column is filtered out.
    if (isMobile && filters.statuses.includes(status)) setMobileStatus(status);
    statusMutation.mutate({ id, status });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected)
        onScreenApplications.forEach((app) => next.delete(app.id));
      else onScreenApplications.forEach((app) => next.add(app.id));
      return next;
    });
  }

  function changeFilters(patch: Partial<ApplicationFilterState>) {
    updateFilters(patch);
    // Changing what is shown clears the selection, so hidden cards are never deleted by surprise.
    if (Object.keys(patch).some((key) => key !== 'sortBy')) {
      setSelectedIds(new Set());
    }
  }

  function clearFilters() {
    changeFilters(EMPTY_FILTERS);
  }

  return (
    <main className='flex min-h-svh w-full max-w-none flex-col gap-8 px-4 py-8 text-left sm:px-6 lg:px-8'>
      <HeroHeader applications={applications} isDemoMode={isDemoMode} />

      <DeleteConfirmationDialog
        isOpen={pendingDeleteIds !== null}
        count={pendingDeleteIds?.length || 0}
        isPending={deleteMutation.isPending}
        onClose={() => setPendingDeleteIds(null)}
        onConfirm={() => {
          if (pendingDeleteIds && !deleteMutation.isPending) {
            deleteMutation.mutate(pendingDeleteIds, {
              onSettled: () => setPendingDeleteIds(null),
            });
          }
        }}
      />

      {statusMutation.isError && (
        <div
          role='alert'
          className='rounded-md border border-destructive/30 p-3'
        >
          <p className='text-sm text-destructive'>
            {statusMutation.error.message}. The card was restored to its
            previous status.
          </p>
        </div>
      )}

      {isPending && (
        <p role='status' className='text-sm text-muted-foreground'>
          Loading applications...
        </p>
      )}

      {isError && (
        <div
          role='alert'
          className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4'
        >
          <div>
            <p className='font-medium'>Could not load applications</p>
            <p className='text-sm text-muted-foreground'>
              {error instanceof Error ? error.message : 'Unexpected error.'}
            </p>
          </div>
          <Button variant='outline' onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isPending && !isError && applications && (
        <>
          <ApplicationFilters
            filters={filters}
            statusCounts={statusCounts}
            isMobile={isMobile}
            visibleCount={visibleApplications.length}
            onScreenCount={onScreenApplications.length}
            totalCount={applications.length}
            allVisibleSelected={allVisibleSelected}
            selectedCount={selectedIds.size}
            isDeletePending={deleteMutation.isPending}
            deleteError={deleteMutation.error?.message}
            onFiltersChange={changeFilters}
            onClearFilters={clearFilters}
            onToggleVisibleSelection={toggleVisibleSelection}
            onDeleteSelected={() => setPendingDeleteIds([...selectedIds])}
          />
          {applications.length > 0 && visibleApplications.length === 0 ? (
            <NoResults onClearFilters={clearFilters} />
          ) : (
            <KanbanBoard
              applications={applications}
              visibleApplications={visibleApplications}
              selectedIds={selectedIds}
              isMobile={isMobile}
              statuses={filters.statuses}
              mobileStatus={shownMobileStatus}
              onMobileStatusChange={setMobileStatus}
              expandedStatuses={expandedStatuses}
              showAllCards={showAllCards}
              onToggleExpanded={toggleExpanded}
              onDragEnd={handleDragEnd}
              onStatusChange={changeApplicationStatus}
              onApplicationSelection={(id, selected) =>
                setSelectedIds((curr) => {
                  const next = new Set(curr);
                  if (selected) {
                    next.add(id);
                  } else {
                    next.delete(id);
                  }
                  return next;
                })
              }
            />
          )}
        </>
      )}
    </main>
  );
}
