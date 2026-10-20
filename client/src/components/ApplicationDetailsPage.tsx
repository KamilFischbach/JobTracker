import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getApplication } from '../services/applications';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat('en-GB').format(date) : 'Not set';
}

function formatSalary(amount: number | string | null, currency: string) {
  return amount === null
    ? 'Not set'
    : `${Number(amount).toLocaleString('en-GB')} ${currency}`;
}

export function ApplicationDetailsPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['applications', applicationId],
    queryFn: () => getApplication(applicationId!),
    enabled: Boolean(applicationId),
  });

  return (
    <main className='mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6'>
      <header className='flex flex-col items-start justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center'>
        <div>
          <p className='text-sm text-muted-foreground'>Personal Job Tracker</p>
          <h1 className='mt-1 text-2xl font-semibold'>Application details</h1>
        </div>
        <Button
          variant='outline'
          className='w-full sm:w-auto'
          onClick={() => navigate('/applications')}
        >
          Back to applications
        </Button>
      </header>

      {query.isPending && (
        <p role='status' className='text-sm text-muted-foreground'>
          Loading application...
        </p>
      )}

      {query.isError && (
        <div
          role='alert'
          className='rounded-md border border-destructive/30 p-4'
        >
          <p className='font-medium'>Could not load application</p>
          <p className='text-sm text-muted-foreground'>{query.error.message}</p>
        </div>
      )}

      {query.data && (
        <Card>
          <CardHeader>
            <CardTitle>{query.data.companyName}</CardTitle>
            <CardDescription>{query.data.jobTitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className='grid gap-5 sm:grid-cols-2'>
              <div>
                <dt className='text-sm text-muted-foreground'>Status</dt>
                <dd>
                  <ApplicationStatusBadge status={query.data.status} />
                </dd>
              </div>
              <div>
                <dt className='text-sm text-muted-foreground'>Applied date</dt>
                <dd>{formatDate(query.data.appliedDate)}</dd>
              </div>
              <div>
                <dt className='text-sm text-muted-foreground'>
                  Minimum salary
                </dt>
                <dd>
                  {formatSalary(query.data.salaryMin, query.data.currency)}
                </dd>
              </div>
              <div>
                <dt className='text-sm text-muted-foreground'>
                  Maximum salary
                </dt>
                <dd>
                  {formatSalary(query.data.salaryMax, query.data.currency)}
                </dd>
              </div>
              <div className='sm:col-span-2'>
                <dt className='text-sm text-muted-foreground'>Job link</dt>
                <dd>
                  {query.data.jobUrl ? (
                    <a
                      href={query.data.jobUrl}
                      target='_blank'
                      rel='noreferrer'
                      className='break-all underline underline-offset-4'
                    >
                      {query.data.jobUrl}
                    </a>
                  ) : (
                    'Not set'
                  )}
                </dd>
              </div>
              <div className='sm:col-span-2'>
                <dt className='text-sm text-muted-foreground'>Notes</dt>
                <dd className='whitespace-pre-wrap'>
                  {query.data.notes || 'No notes'}
                </dd>
              </div>
              <div>
                <dt className='text-sm text-muted-foreground'>Currency</dt>
                <dd>{query.data.currency}</dd>
              </div>
              <div>
                <dt className='text-sm text-muted-foreground'>
                  Application ID
                </dt>
                <dd className='break-all font-mono text-xs'>{query.data.id}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
