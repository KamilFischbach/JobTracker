import {
  APPLICATION_STATUS_META,
  type ApplicationStatus,
} from '../types/ApplicationStatus';

export function ApplicationStatusBadge({
  status,
}: {
  status: ApplicationStatus;
}) {
  const meta = APPLICATION_STATUS_META[status];

  return (
    <span
      className={`inline-flex w-fit items-center rounded-sm px-2 py-1 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
