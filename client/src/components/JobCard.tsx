import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Menu } from '@base-ui/react/menu';
import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, GripVertical, MoreHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
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
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } =
    useDraggable({ id: jobApplication.id, disabled: isMobile });
  // The board shows a floating copy while dragging, so this card stays put.
  const accent = APPLICATION_STATUS_META[jobApplication.status].cardEdge;

  return (
    <Card
      ref={setNodeRef}
      className={`flex w-full flex-col gap-0 overflow-visible border-l-4 ${accent} transition-[box-shadow,translate,opacity] duration-200 ${isDragging ? 'opacity-40 grayscale' : 'hover:shadow-lg hover:shadow-black/10 hover:ring-line-strong dark:hover:shadow-black/40 motion-safe:hover:-translate-y-0.5'}`}
    >
      <CardHeader className='flex flex-row items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-1 items-start gap-2'>
          <Input
            type='checkbox'
            checked={selected}
            aria-label={`Select ${jobApplication.companyName}`}
            className='mt-1 size-4 min-w-4 accent-primary'
            onChange={(event) =>
              onSelectedChange(jobApplication.id, event.currentTarget.checked)
            }
          />
          {/* One line each, so every collapsed card has the same height. */}
          <div className='min-w-0 flex-1 space-y-1'>
            <CardTitle
              className='text-fade text-base leading-snug'
              title={jobApplication.companyName}
            >
              {jobApplication.companyName}
            </CardTitle>
            <CardDescription
              className='text-fade'
              title={jobApplication.jobTitle}
            >
              {jobApplication.jobTitle}
            </CardDescription>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          {isMobile ? (
            // Base UI renders the menu above the page and flips it upward
            // when there is no room below, so it is never cut off.
            <Menu.Root modal={false}>
              <Menu.Trigger
                className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                aria-label='Change application status'
                title='Change status'
              >
                <MoreHorizontal aria-hidden='true' className='size-4' />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner
                  className='z-50 outline-none'
                  side='bottom'
                  align='end'
                  sideOffset={4}
                  collisionPadding={12}
                >
                  <Menu.Popup
                    aria-label={`Move ${jobApplication.companyName} application`}
                    className='min-w-44 origin-(--transform-origin) rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0'
                  >
                    {APPLICATION_STATUSES.filter(
                      (status) => status !== jobApplication.status,
                    ).map((status) => (
                      <Menu.Item
                        key={status}
                        className='flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2.5 text-sm outline-none data-highlighted:bg-muted'
                        onClick={() =>
                          onStatusChange(jobApplication.id, status)
                        }
                      >
                        <span
                          aria-hidden='true'
                          className={`size-2 rounded-full ${APPLICATION_STATUS_META[status].swatch}`}
                        />
                        Move to {APPLICATION_STATUS_META[status].label}
                      </Menu.Item>
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
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
            <ChevronDown
              aria-hidden='true'
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key='details'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className='overflow-hidden'
          >
            <CardContent className='space-y-4 pt-4'>
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
                  state={{ fromBoard: true }}
                  className='inline-flex min-h-9 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2'
                >
                  View details
                </Link>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
