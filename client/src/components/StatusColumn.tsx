import { useDroppable } from '@dnd-kit/core';
import {
  type ApplicationStatus,
  APPLICATION_STATUS_META,
} from '../types/ApplicationStatus';
import type { JobApplicationType } from '../types/JobApplication';
import { JobCard } from './JobCard';

export function StatusColumn({
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
        <h2 className='text-sm font-semibold text-black!'>{meta.label}</h2>
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
