import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDraggable } from '@dnd-kit/core';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_META,
  type ApplicationStatus,
} from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';

function formatDate(date?: Date | null) {
  return date ? new Intl.DateTimeFormat('en-GB').format(date) : 'Not set';
}

function formatSalaryRange(
  minimum: number | string | null,
  maximum: number | string | null,
  currency: string | null,
) {
  if (minimum === null && maximum === null) return 'Not specified';

  const formatAmount = (amount: number | string | null, fallback: string) =>
    amount === null ? fallback : Number(amount).toLocaleString('en-GB');

  return `${formatAmount(minimum, 'No min')} to ${formatAmount(maximum, 'No max')} ${currency ?? 'PLN'}`;
}

export function JobCard({
  jobApplication,
  selected,
  isMobile,
  onSelectedChange,
  onStatusChange,
}: {
  jobApplication: JobApplicationType;
  selected: boolean;
  isMobile: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: jobApplication.id, disabled: isMobile });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  useEffect(() => {
    if (!statusMenuOpen) return;

    const closeOnOutsideInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !statusMenuRef.current?.contains(target)) {
        setStatusMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatusMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideInteraction, true);
    document.addEventListener('wheel', closeOnOutsideInteraction, true);
    document.addEventListener('scroll', closeOnOutsideInteraction, true);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener(
        'pointerdown',
        closeOnOutsideInteraction,
        true,
      );
      document.removeEventListener('wheel', closeOnOutsideInteraction, true);
      document.removeEventListener('scroll', closeOnOutsideInteraction, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [statusMenuOpen]);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`flex w-full flex-col overflow-visible ${isDragging ? 'opacity-50' : ''}`}
    >
      <CardHeader className='flex flex-row items-start justify-between gap-3'>
        <div className='flex min-w-0 items-start gap-2'>
          <Input
            type='checkbox'
            checked={selected}
            aria-label={`Select ${jobApplication.companyName}`}
            className='mt-1 size-4 min-w-4 accent-primary'
            onChange={(event) =>
              onSelectedChange(jobApplication.id, event.currentTarget.checked)
            }
          />
          <div className='min-w-0 space-y-1'>
            <CardTitle className='text-base leading-snug'>
              {jobApplication.companyName}
            </CardTitle>
            <CardDescription className='line-clamp-2'>
              {jobApplication.jobTitle}
            </CardDescription>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          {isMobile ? (
            <div ref={statusMenuRef} className='relative'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='Change application status'
                title='Change status'
                aria-haspopup='menu'
                aria-expanded={statusMenuOpen}
                onClick={() => setStatusMenuOpen((open) => !open)}
              >
                <MoreHorizontal aria-hidden='true' className='size-4' />
              </Button>
              {statusMenuOpen && (
                <div
                  role='menu'
                  aria-label={`Move ${jobApplication.companyName} application`}
                  className='absolute right-0 top-full z-30 mt-1 min-w-44 rounded-md border bg-popover p-1 shadow-md'
                >
                  {APPLICATION_STATUSES.filter(
                    (status) => status !== jobApplication.status,
                  ).map((status) => (
                    <button
                      key={status}
                      type='button'
                      role='menuitem'
                      className='w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none'
                      onClick={() => {
                        onStatusChange(jobApplication.id, status);
                        setStatusMenuOpen(false);
                      }}
                    >
                      Move to {APPLICATION_STATUS_META[status].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Button
              ref={setActivatorNodeRef}
              type='button'
              variant='ghost'
              size='icon'
              className='touch-none'
              aria-label={`Drag ${jobApplication.companyName} application`}
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden='true' />
            </Button>
          )}
          <Button
            type='button'
            variant='outline'
            size='icon'
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${jobApplication.companyName} details`}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <ChevronUp aria-hidden='true' />
            ) : (
              <ChevronDown aria-hidden='true' />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <p className='text-xs text-muted-foreground'>Salary range</p>
              <p className='text-sm'>
                {formatSalaryRange(
                  jobApplication.salaryMin,
                  jobApplication.salaryMax,
                  jobApplication.currency,
                )}
              </p>
            </div>
            <div className='text-right'>
              <p className='text-xs text-muted-foreground'>Applied date</p>
              <p className='text-sm'>
                {formatDate(jobApplication.appliedDate)}
              </p>
            </div>
          </div>
          <div className='border-t pt-3 text-center'>
            <Link
              to={`/applications/${jobApplication.id}`}
              className='inline-flex min-h-9 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2'
            >
              View details
            </Link>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
