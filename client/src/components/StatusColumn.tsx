import { useDroppable } from '@dnd-kit/core';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { COLUMN_CARD_LIMIT, getShownCards } from '../lib/column-cards';
import {
  type ApplicationStatus,
  APPLICATION_STATUS_META,
} from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';
import { JobCard } from './JobCard';

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export function StatusColumn({
  status,
  columnIndex,
  applications,
  isExpanded,
  showAllCards,
  selectedIds,
  isMobile,
  onToggleExpanded,
  onSelectedChange,
  onStatusChange,
}: {
  status: ApplicationStatus;
  columnIndex: number;
  /** Every card in this column; only the first few show until expanded. */
  applications: JobApplicationType[];
  isExpanded: boolean;
  /** Show every card regardless of the limit (e.g. while searching). */
  showAllCards: boolean;
  selectedIds: Set<string>;
  isMobile: boolean;
  onToggleExpanded: () => void;
  onSelectedChange: (id: string, selected: boolean) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
    disabled: isMobile,
  });
  const meta = APPLICATION_STATUS_META[status];
  const shownApplications = getShownCards(applications, {
    expanded: isExpanded,
    showAll: showAllCards,
  });
  const hiddenCount = applications.length - shownApplications.length;
  // "Show less" only makes sense for an expanded column that has extra cards.
  const canCollapse =
    !showAllCards && isExpanded && applications.length > COLUMN_CARD_LIMIT;

  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label} applications`}
      className={`relative flex min-w-0 flex-col gap-3 rounded-xl border p-3 pt-4 transition-all duration-200 ${meta.column} ${isMobile ? 'w-full' : ''} ${isOver ? `scale-[1.01] shadow-xl ring-2 ${meta.over}` : 'shadow-sm'}`}
    >
      <div
        aria-hidden='true'
        className={`absolute inset-x-0 top-0 h-1.5 rounded-t-xl bg-linear-to-r ${meta.bar}`}
      />
      <header className='flex items-center justify-between gap-2'>
        <h2 className='m-0! flex items-center gap-2 text-sm font-semibold text-ink!'>
          <span
            aria-hidden='true'
            className={`size-2.5 rounded-full ${meta.dot}`}
          />
          {meta.label}
        </h2>
        <span
          className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${meta.count}`}
        >
          {applications.length}
        </span>
      </header>
      {/* Cards stagger in when the column first appears; cards added later just pop in. */}
      <motion.div
        className='relative flex min-h-36 flex-col gap-3'
        initial='hidden'
        animate='show'
        variants={{
          show: {
            transition: {
              delayChildren: columnIndex * 0.08,
              staggerChildren: 0.05,
            },
          },
        }}
      >
        <AnimatePresence mode='popLayout'>
          {shownApplications.map((application) => (
            <motion.div
              key={application.id}
              layout
              variants={cardVariants}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <JobCard
                jobApplication={application}
                selected={selectedIds.has(application.id)}
                isMobile={isMobile}
                onSelectedChange={onSelectedChange}
                onStatusChange={onStatusChange}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {applications.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`rounded-lg border-2 border-dashed py-6 text-center text-xs text-muted-foreground transition-colors ${isOver ? 'border-current' : 'border-line'}`}
          >
            Drop an application here
          </motion.p>
        )}
      </motion.div>

      {(hiddenCount > 0 || canCollapse) && (
        <motion.button
          layout='position'
          type='button'
          aria-expanded={hiddenCount === 0}
          className='mt-auto flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:bg-glass-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-ring'
          onClick={onToggleExpanded}
        >
          {hiddenCount > 0 ? `Show ${hiddenCount} more` : 'Show less'}
          <ChevronDown
            aria-hidden='true'
            className={`size-3.5 transition-transform duration-300 ${hiddenCount === 0 ? 'rotate-180' : ''}`}
          />
        </motion.button>
      )}
    </section>
  );
}
