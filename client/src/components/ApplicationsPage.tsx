import { Button } from '@/components/ui/button';
import type { DragEndEvent } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  filterAndSortApplications,
  type ApplicationSort,
} from '../lib/application-list';
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
import { ApplicationFormDialog } from './ApplicationFormDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { KanbanBoard } from './KanbanBoard';

const applicationsQueryKey = ['applications'] as const;

export function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [appliedAfter, setAppliedAfter] = useState('');
  const [appliedBefore, setAppliedBefore] = useState('');
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 639px)').matches,
  );
  const [mobileStatusIndex, setMobileStatusIndex] = useState(0);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(
    null,
  );
  const [sortBy, setSortBy] = useState<ApplicationSort>('applied-newest');
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
        setMobileStatusIndex(
          APPLICATION_STATUSES.indexOf(context.previousApplication.status),
        );
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

  const visibleApplications = filterAndSortApplications(applications ?? [], {
    searchText,
    appliedAfter,
    appliedBefore,
    sortBy,
  });
  const allVisibleSelected =
    visibleApplications.length > 0 &&
    visibleApplications.every((app) => selectedIds.has(app.id));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || typeof over.id !== 'string') return;
      const directStatus = APPLICATION_STATUSES.find((s) => s === over.id);
      const app = applications?.find((item) => item.id === String(active.id));
      const overApp = applications?.find((item) => item.id === String(over.id));
      const nextStatus = directStatus ?? overApp?.status;

      if (!nextStatus || !app || app.status === nextStatus) return;
      statusMutation.reset();
      statusMutation.mutate({ id: app.id, status: nextStatus });
    },
    [applications, statusMutation],
  );

  function changeApplicationStatus(id: string, status: ApplicationStatus) {
    statusMutation.reset();
    if (isMobile) setMobileStatusIndex(APPLICATION_STATUSES.indexOf(status));
    statusMutation.mutate({ id, status });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected)
        visibleApplications.forEach((app) => next.delete(app.id));
      else visibleApplications.forEach((app) => next.add(app.id));
      return next;
    });
  }

  function clearFilters(update: () => void) {
    update();
    setSelectedIds(new Set());
  }

  return (
    <main className='flex min-h-svh w-full max-w-none flex-col gap-8 px-4 py-8 text-left sm:px-6 lg:px-8'>
      <header className='flex flex-wrap items-center justify-between gap-4 border-b pb-5'>
        <div>
          <p className='text-sm text-muted-foreground'>Personal Job Tracker</p>
          <h1 className='mt-1 text-3xl font-semibold text-black!'>
            Applications
          </h1>
        </div>
        <ApplicationFormDialog />
      </header>

      {isDemoMode && (
        <p className='w-fit rounded-sm border bg-muted px-3 py-1 text-xs text-muted-foreground'>
          Demo mode: sample data saved in this browser
        </p>
      )}

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
            searchText={searchText}
            appliedAfter={appliedAfter}
            appliedBefore={appliedBefore}
            sortBy={sortBy}
            visibleCount={visibleApplications.length}
            totalCount={applications.length}
            allVisibleSelected={allVisibleSelected}
            hasSelectedIds={selectedIds.size > 0}
            isDeletePending={deleteMutation.isPending}
            deleteError={deleteMutation.error?.message}
            onSearchChange={(v) => clearFilters(() => setSearchText(v))}
            onAppliedAfterChange={(v) => clearFilters(() => setAppliedAfter(v))}
            onAppliedBeforeChange={(v) =>
              clearFilters(() => setAppliedBefore(v))
            }
            onSortByChange={setSortBy}
            onToggleVisibleSelection={toggleVisibleSelection}
            onDeleteSelected={() => setPendingDeleteIds([...selectedIds])}
          />
          <KanbanBoard
            applications={applications}
            visibleApplications={visibleApplications}
            selectedIds={selectedIds}
            isMobile={isMobile}
            mobileStatusIndex={mobileStatusIndex}
            setMobileStatusIndex={setMobileStatusIndex}
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
        </>
      )}
    </main>
  );
}
