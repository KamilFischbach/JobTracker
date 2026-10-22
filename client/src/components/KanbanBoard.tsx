import { Button } from '@/components/ui/button';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
  mobileStatusIndex: number;
  setMobileStatusIndex: (index: number | ((curr: number) => number)) => void;
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

export function KanbanBoard({
  visibleApplications,
  selectedIds,
  isMobile,
  mobileStatusIndex,
  setMobileStatusIndex,
  onDragEnd,
  onApplicationSelection,
  onStatusChange,
}: Props) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const topScrollbarSpacerRef = useRef<HTMLDivElement>(null);

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
  }, [visibleApplications.length, isMobile]);

  return (
    <DndContext
      sensors={isMobile ? [] : sensors}
      collisionDetection={pointerFirstCollisionDetection}
      onDragEnd={onDragEnd}
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
                setMobileStatusIndex((curr) => Math.max(0, curr - 1))
              }
            >
              <ChevronLeft aria-hidden='true' />
            </Button>
            <p aria-live='polite' className='text-sm font-medium'>
              {
                APPLICATION_STATUS_META[APPLICATION_STATUSES[mobileStatusIndex]]
                  .label
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
              disabled={mobileStatusIndex === APPLICATION_STATUSES.length - 1}
              onClick={() =>
                setMobileStatusIndex((curr) =>
                  Math.min(APPLICATION_STATUSES.length - 1, curr + 1),
                )
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
                (app) => app.status === status,
              )}
              selectedIds={selectedIds}
              isMobile={isMobile}
              onSelectedChange={onApplicationSelection}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </section>
    </DndContext>
  );
}
