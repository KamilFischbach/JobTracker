import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  APPLICATION_STATUS_META,
  type ApplicationStatus,
} from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';
import { ApplicationFormDialog } from './ApplicationFormDialog';
import { JobCard } from './JobCard';

const applicationsQueryKey = ['applications'] as const;

const pointerFirstCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0
    ? pointerCollisions
    : closestCorners(args);
};

function StatusColumn({
  status,
  applications,
  selectedIds,
  isMobile,
  onSelectedChange,
  onStatusChange,
}: {
  status: ApplicationStatus;
  applications: JobApplicationType[];
  selectedIds: Set<string>;
  isMobile: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
    disabled: isMobile,
  });
  const meta = APPLICATION_STATUS_META[status];

  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label} applications`}
      className={`flex min-w-0 flex-col gap-3 rounded-md border p-3 transition-colors ${isMobile ? 'w-full' : 'w-72.5 min-w-72.5 shrink-0'} ${isOver ? 'border-primary bg-muted/70' : 'bg-muted/30'}`}
    >
      <header className='flex items-center justify-between gap-2'>
        <h2 className='text-sm font-semibold'>{meta.label}</h2>
        <span className='text-xs text-muted-foreground'>
          {applications.length}
        </span>
      </header>
      <div className='flex min-h-36 flex-col gap-3'>
        {applications.map((application) => (
          <JobCard
            key={application.id}
            jobApplication={application}
            selected={selectedIds.has(application.id)}
            isMobile={isMobile}
            onSelectedChange={onSelectedChange}
            onStatusChange={onStatusChange}
          />
        ))}
        {applications.length === 0 && (
          <p className='py-4 text-center text-xs text-muted-foreground'>
            Drop an application here
          </p>
        )}
      </div>
    </section>
  );
}

export function ApplicationsPage() {
  const queryClient = useQueryClient();
  const columnsRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const topScrollbarSpacerRef = useRef<HTMLDivElement>(null);
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
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const updateMobileLayout = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateMobileLayout);
    return () => mediaQuery.removeEventListener('change', updateMobileLayout);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const columns = columnsRef.current;
    const topScrollbar = topScrollbarRef.current;
    const spacer = topScrollbarSpacerRef.current;
    if (!columns || !topScrollbar || !spacer) return;

    const updateScrollbar = () => {
      spacer.style.width = `${columns.scrollWidth}px`;
      topScrollbar.scrollLeft = columns.scrollLeft;
    };
    const syncFromBoard = () => {
      topScrollbar.scrollLeft = columns.scrollLeft;
    };
    const syncFromTop = () => {
      columns.scrollLeft = topScrollbar.scrollLeft;
    };

    updateScrollbar();
    columns.addEventListener('scroll', syncFromBoard, { passive: true });
    topScrollbar.addEventListener('scroll', syncFromTop, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(columns);
    if (columns.firstElementChild) {
      resizeObserver.observe(columns.firstElementChild);
    }

    return () => {
      columns.removeEventListener('scroll', syncFromBoard);
      topScrollbar.removeEventListener('scroll', syncFromTop);
      resizeObserver.disconnect();
    };
  }, [applications?.length, isMobile]);

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
            current?.map((application) =>
              application.id === id ? { ...application, status } : application,
            ),
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
      if (context?.previousApplications) {
        queryClient.setQueryData(
          applicationsQueryKey,
          context.previousApplications,
        );
      }
      if (context?.previousApplication) {
        queryClient.setQueryData(
          ['applications', id],
          context.previousApplication,
        );
      }
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
        (current) =>
          current?.filter((application) => !ids.includes(application.id)),
      );

      return { previousApplications };
    },
    onError: (_error, _ids, context) => {
      if (context?.previousApplications) {
        queryClient.setQueryData(
          applicationsQueryKey,
          context.previousApplications,
        );
      }
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
    visibleApplications.every((application) => selectedIds.has(application.id));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || typeof over.id !== 'string') return;

      const directStatus = APPLICATION_STATUSES.find(
        (status) => status === over.id,
      );
      const application = applications?.find(
        (item) => item.id === String(active.id),
      );
      const overApplication = applications?.find(
        (item) => item.id === String(over.id),
      );
      const nextStatus = directStatus ?? overApplication?.status;
      if (!nextStatus || !application || application.status === nextStatus)
        return;

      statusMutation.reset();
      statusMutation.mutate({ id: application.id, status: nextStatus });
    },
    [applications, statusMutation],
  );

  function confirmDelete(ids: string[]) {
    if (ids.length === 0) return;
    deleteMutation.reset();
    setPendingDeleteCount(ids.length);
    setPendingDeleteIds(ids);
  }

  function changeApplicationStatus(id: string, status: ApplicationStatus) {
    statusMutation.reset();
    if (isMobile) {
      setMobileStatusIndex(APPLICATION_STATUSES.indexOf(status));
    }
    statusMutation.mutate({ id, status });
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open && !deleteMutation.isPending) setPendingDeleteIds(null);
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteIds || deleteMutation.isPending) return;

    deleteMutation.mutate(pendingDeleteIds, {
      onSettled: () => setPendingDeleteIds(null),
    });
  }

  function toggleApplicationSelection(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleApplications.forEach((application) =>
          next.delete(application.id),
        );
      } else {
        visibleApplications.forEach((application) => next.add(application.id));
      }
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
          <h1 className='mt-1 text-3xl font-semibold !text-black'>
            Applications
          </h1>
        </div>
        <ApplicationFormDialog />
      </header>

      {isDemoMode && (
        <p className='w-fit rounded-sm border bg-muted px-3 py-1 text-xs text-muted-foreground'>
          Demo mode · sample data saved in this browser
        </p>
      )}

      <Dialog
        open={pendingDeleteIds !== null}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {pendingDeleteCount}{' '}
              {pendingDeleteCount === 1 ? 'application' : 'applications'}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes the selected application
              {pendingDeleteCount === 1 ? '' : 's'}. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={deleteMutation.isPending}
              onClick={() => setPendingDeleteIds(null)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              variant='destructive'
              disabled={deleteMutation.isPending}
              onClick={handleDeleteConfirm}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <section aria-label='Application filters' className='grid gap-3'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem_auto_auto] xl:items-end'>
            <label className='grid min-w-0 gap-1 text-sm'>
              Search company, title, or notes
              <Input
                type='search'
                value={searchText}
                placeholder='e.g. Acme or platform engineer'
                onChange={(event) =>
                  clearFilters(() => setSearchText(event.currentTarget.value))
                }
              />
            </label>
            <label className='grid min-w-0 gap-1 text-sm'>
              Applied from
              <Input
                type='date'
                value={appliedAfter}
                onChange={(event) =>
                  clearFilters(() => setAppliedAfter(event.currentTarget.value))
                }
              />
            </label>
            <label className='grid min-w-0 gap-1 text-sm'>
              Applied through
              <Input
                type='date'
                value={appliedBefore}
                onChange={(event) =>
                  clearFilters(() =>
                    setAppliedBefore(event.currentTarget.value),
                  )
                }
              />
            </label>
            <label className='grid min-w-0 gap-1 text-sm'>
              Sort by
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.currentTarget.value as typeof sortBy)
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
              disabled={visibleApplications.length === 0}
              onClick={toggleVisibleSelection}
            >
              {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
            </Button>
            <Button
              type='button'
              variant='destructive'
              className='w-full justify-center whitespace-nowrap xl:w-auto'
              disabled={selectedIds.size === 0 || deleteMutation.isPending}
              onClick={() => confirmDelete([...selectedIds])}
            >
              Delete selected
            </Button>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm text-muted-foreground'>
              Showing {visibleApplications.length} of {applications.length}
            </p>
            {deleteMutation.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {deleteMutation.error.message}. Deleted cards were restored.
              </p>
            )}
          </div>
        </section>
      )}

      {!isPending && !isError && applications && (
        <DndContext
          sensors={isMobile ? [] : sensors}
          collisionDetection={pointerFirstCollisionDetection}
          onDragEnd={handleDragEnd}
        >
          <section aria-label='Kanban board' className='w-full min-w-0'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
              <p className='text-sm text-muted-foreground'>
                {visibleApplications.length} application
                {visibleApplications.length === 1 ? '' : 's'}
              </p>
              <div className='flex w-full items-center justify-between gap-2 sm:hidden'>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  title='Previous status column'
                  aria-label='Previous status column'
                  disabled={mobileStatusIndex === 0}
                  onClick={() =>
                    setMobileStatusIndex((current) => Math.max(0, current - 1))
                  }
                >
                  <ChevronLeft aria-hidden='true' />
                </Button>
                <p aria-live='polite' className='text-sm font-medium'>
                  {
                    APPLICATION_STATUS_META[
                      APPLICATION_STATUSES[mobileStatusIndex]
                    ].label
                  }{' '}
                  <span className='text-muted-foreground'>
                    {mobileStatusIndex + 1} / {APPLICATION_STATUSES.length}
                  </span>
                </p>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  title='Next status column'
                  aria-label='Next status column'
                  disabled={
                    mobileStatusIndex === APPLICATION_STATUSES.length - 1
                  }
                  onClick={() =>
                    setMobileStatusIndex((current) =>
                      Math.min(APPLICATION_STATUSES.length - 1, current + 1),
                    )
                  }
                >
                  <ChevronRight aria-hidden='true' />
                </Button>
              </div>
            </div>
            <div
              ref={topScrollbarRef}
              role='region'
              aria-label='Scroll Kanban board horizontally'
              tabIndex={0}
              className='kanban-top-scrollbar mb-2 hidden w-full overflow-x-auto overflow-y-hidden sm:block'
            >
              <div
                ref={topScrollbarSpacerRef}
                aria-hidden='true'
                className='h-px'
              />
            </div>
            <div
              ref={columnsRef}
              role='region'
              aria-label='Application status columns'
              tabIndex={0}
              className={`kanban-horizontal-scroll flex w-full min-w-0 items-start gap-4 pb-4 ${isMobile ? 'flex-col overflow-x-hidden' : 'overflow-x-auto overscroll-x-contain'}`}
            >
              {(isMobile
                ? [APPLICATION_STATUSES[mobileStatusIndex]]
                : APPLICATION_STATUSES
              ).map((status) => (
                <StatusColumn
                  key={status}
                  status={status}
                  applications={visibleApplications.filter(
                    (application) => application.status === status,
                  )}
                  selectedIds={selectedIds}
                  isMobile={isMobile}
                  onSelectedChange={toggleApplicationSelection}
                  onStatusChange={changeApplicationStatus}
                />
              ))}
            </div>
          </section>
        </DndContext>
      )}
    </main>
  );
}
