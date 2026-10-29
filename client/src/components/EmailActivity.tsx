import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Mail } from 'lucide-react';
import { getEmailEvents } from '../services/applications';
import { APPLICATION_STATUS_META } from '../types/ApplicationStatus';
import type {
  EmailCategory,
  EmailEvent,
  EmailOutcome,
} from '../types/EmailEvent';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';

const CATEGORY_LABEL: Record<EmailCategory, string> = {
  APPLICATION_RECEIVED: 'Application received',
  INTERVIEW_INVITATION: 'Interview invitation',
  REJECTION: 'Rejection',
  OFFER: 'Offer',
  NOT_JOB_RELATED: 'Not job related',
};

function outcomeText(event: EmailEvent): string {
  const outcomes: Record<EmailOutcome, string> = {
    UPDATED: 'Status updated',
    NO_CHANGE: 'Status kept: it would move the application backwards',
    NEEDS_REVIEW: 'Not applied: the AI was unsure, check it yourself',
    NO_MATCH: 'No matching application',
    IGNORED: 'Ignored',
  };
  return outcomes[event.outcome];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

// Emails the n8n workflow read and linked to this application.
export function EmailActivity({ applicationId }: { applicationId: string }) {
  const query = useQuery({
    queryKey: ['applications', applicationId, 'email-events'],
    queryFn: () => getEmailEvents(applicationId),
    refetchInterval: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Mail aria-hidden='true' className='size-4 text-violet-500' />
          Email activity
        </CardTitle>
        <CardDescription>
          Recruiter emails read by the n8n automation and classified by AI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending && (
          <p role='status' className='text-sm text-muted-foreground'>
            Loading email activity...
          </p>
        )}
        {query.isError && (
          <p role='alert' className='text-sm text-destructive'>
            {query.error.message}
          </p>
        )}
        {query.data?.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            No emails about this application yet.
          </p>
        )}
        {query.data && query.data.length > 0 && (
          <ol className='space-y-4'>
            {query.data.map((event) => (
              <li
                key={event.id}
                className='space-y-1.5 border-l-2 border-violet-500/40 pl-4'
              >
                <p className='text-xs text-muted-foreground'>
                  {formatDateTime(event.receivedAt)} · {event.fromAddress}
                </p>
                <p className='font-medium break-words'>
                  {event.subject || '(no subject)'}
                </p>
                <p className='text-sm'>
                  <span className='font-medium'>
                    {CATEGORY_LABEL[event.category]}
                  </span>{' '}
                  <span className='text-muted-foreground'>
                    ({Math.round(event.confidence * 100)}% sure)
                  </span>
                </p>
                {event.reason && (
                  <p className='text-sm text-muted-foreground italic'>
                    “{event.reason}”
                  </p>
                )}
                {event.outcome === 'UPDATED' &&
                event.previousStatus &&
                event.newStatus ? (
                  <p
                    className='flex flex-wrap items-center gap-1.5 text-sm'
                    aria-label={`Status changed from ${APPLICATION_STATUS_META[event.previousStatus].label} to ${APPLICATION_STATUS_META[event.newStatus].label}`}
                  >
                    <ApplicationStatusBadge status={event.previousStatus} />
                    <ArrowRight aria-hidden='true' className='size-3.5' />
                    <ApplicationStatusBadge status={event.newStatus} />
                  </p>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    {outcomeText(event)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
