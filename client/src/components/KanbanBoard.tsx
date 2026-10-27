import { Button } from '@/components/ui/button';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_META,
  type ApplicationStatus,
} from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';
import { StatusColumn } from './StatusColumn';

interface Props {
  applications: JobApplicationType[];
  visibleApplications: JobApplicationType[];
  selectedIds: Set<string>;
  isMobile: boolean;
  /** Columns to show, in board order. */
  statuses: ApplicationStatus[];
  /** The one column shown on mobile; must be one of `statuses`. */
  mobileStatus: ApplicationStatus;
  onMobileStatusChange: (status: ApplicationStatus) => void;
  /** Columns opened with "Show more". */
  expandedStatuses: Set<ApplicationStatus>;
  /** Show every card in every column (e.g. while searching). */
  showAllCards: boolean;
  onToggleExpanded: (status: ApplicationStatus) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onApplicationSelection: (id: string, selected: boolean) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}

const pointerFirstCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0
    ? pointerCollisions
    : closestCorners(args);
};

function DragPreview({ application }: { application: JobApplicationType }) {
  const meta = APPLICATION_STATUS_META[application.status];
  return (
    <div
      className={`w-72.5 rotate-3 scale-105 cursor-grabbing rounded-xl border-l-4 bg-card p-4 shadow-2xl shadow-black/20 ring-1 ring-line-strong dark:shadow-black/60 ${meta.cardEdge}`}
    >
      <p className='text-fade text-base font-semibold leading-snug text-ink'>
        {application.companyName}
      </p>
      <p className='text-fade text-sm text-muted-foreground'>
        {application.jobTitle}
      </p>
    </div>
  );
}

export function KanbanBoard({
  visibleApplications,
  selectedIds,
  isMobile,
  statuses,
  mobileStatus,
  onMobileStatusChange,
  expandedStatuses,
  showAllCards,
  onToggleExpanded,
  onDragEnd,
  onApplicationSelection,
  onStatusChange,
}: Props) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const topScrollbarSpacerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const mobileStatusIndex = Math.max(0, statuses.indexOf(mobileStatus));
  const activeApplication = activeId
    ? visibleApplications.find((app) => app.id === activeId)
    : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

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
    if (columns.firstElementChild)
      resizeObserver.observe(columns.firstElementChild);

    return () => {
      columns.removeEventListener('scroll', syncFromBoard);
      topScrollbar.removeEventListener('scroll', syncFromTop);
      resizeObserver.disconnect();
    };
  }, [visibleApplications.length, isMobile, statuses.length]);

  return (
    <DndContext
      sensors={isMobile ? [] : sensors}
      collisionDetection={pointerFirstCollisionDetection}
      onDragStart={(event: DragStartEvent) =>
        setActiveId(String(event.active.id))
      }
      onDragEnd={(event) => {
        setActiveId(null);
        onDragEnd(event);
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <section aria-label='Kanban board' className='w-full min-w-0'>
        {/* A light heading instead of another card around the board. */}
        <div className='mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
          <div className='flex items-baseline gap-3'>
            <h2 className='m-0! text-xl! font-semibold! tracking-tight text-ink!'>
              Board
            </h2>
            <p className='text-sm text-ink-muted'>
              {visibleApplications.length}{' '}
              {visibleApplications.length === 1
                ? 'application'
                : 'applications'}
            </p>
          </div>
          {!isMobile && (
            <p className='text-xs text-ink-subtle'>
              Drag cards between columns to update their status
            </p>
          )}
        </div>

        <div className='mb-3 flex flex-wrap items-center justify-between gap-3 sm:hidden'>
          <div className='flex w-full items-center justify-between gap-2 sm:hidden'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              title='Previous status column'
              aria-label='Previous status column'
              disabled={mobileStatusIndex === 0}
              onClick={() =>
                onMobileStatusChange(statuses[mobileStatusIndex - 1])
              }
            >
              <ChevronLeft aria-hidden='true' />
            </Button>
            <p aria-live='polite' className='text-sm font-medium'>
              {APPLICATION_STATUS_META[statuses[mobileStatusIndex]].label}{' '}
              <span className='text-muted-foreground'>
                {mobileStatusIndex + 1} / {statuses.length}
              </span>
            </p>
            <Button
              type='button'
              variant='outline'
              size='icon'
              title='Next status column'
              aria-label='Next status column'
              disabled={mobileStatusIndex === statuses.length - 1}
              onClick={() =>
                onMobileStatusChange(statuses[mobileStatusIndex + 1])
              }
            >
              <ChevronRight aria-hidden='true' />
            </Button>
          </div>
        </div>

        <div
          ref={topScrollbarRef}
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
          tabIndex={0}
          className={`kanban-horizontal-scroll w-full min-w-0 gap-4 pb-4 ${isMobile ? 'flex flex-col overflow-x-hidden' : 'grid overflow-x-auto overscroll-x-contain'}`}
          // Desktop: columns share the full width (lining up with the filters
          // card), never narrower than 16rem (then the board scrolls sideways)
          // and never wider than 24rem when only a few statuses are shown.
          style={
            isMobile
              ? undefined
              : {
                  gridTemplateColumns: `repeat(${statuses.length}, minmax(16rem, 1fr))`,
                  maxWidth: `calc(${statuses.length} * 24rem + ${statuses.length - 1} * 1rem)`,
                }
          }
        >
          {(isMobile ? [statuses[mobileStatusIndex]] : statuses).map(
            (status) => (
              <StatusColumn
                key={status}
                status={status}
                columnIndex={APPLICATION_STATUSES.indexOf(status)}
                applications={visibleApplications.filter(
                  (app) => app.status === status,
                )}
                isExpanded={expandedStatuses.has(status)}
                showAllCards={showAllCards}
                onToggleExpanded={() => onToggleExpanded(status)}
                selectedIds={selectedIds}
                isMobile={isMobile}
                onSelectedChange={onApplicationSelection}
                onStatusChange={onStatusChange}
              />
            ),
          )}
        </div>
      </section>
      <DragOverlay dropAnimation={null}>
        {activeApplication && <DragPreview application={activeApplication} />}
      </DragOverlay>
    </DndContext>
  );
}
