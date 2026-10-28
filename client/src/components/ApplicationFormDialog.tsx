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
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import {
  createApplication,
  isDemoMode,
  type OfferDraft,
} from '../services/applications';
import { OfferImport } from './OfferImport';

const DEFAULT_CURRENCY = 'PLN';

// The form is uncontrolled, so imported values are written into its fields.
function fillForm(form: HTMLFormElement, draft: OfferDraft) {
  const values: Record<string, string | number | null> = {
    companyName: draft.companyName,
    jobTitle: draft.jobTitle,
    jobUrl: draft.jobUrl,
    salaryMin: draft.salaryMin,
    salaryMax: draft.salaryMax,
    notes: draft.notes,
  };

  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
    ) {
      field.value = value == null ? '' : String(value);
    }
  }
}

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function ApplicationFormDialog() {
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['applications'] });
      formRef.current?.reset();
      setCurrency(DEFAULT_CURRENCY);
      setOpen(false);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const companyName = String(formData.get('companyName') ?? '').trim();
    const jobTitle = String(formData.get('jobTitle') ?? '').trim();
    const jobUrl = String(formData.get('jobUrl') ?? '').trim();
    const salaryMinValue = String(formData.get('salaryMin') ?? '');
    const salaryMaxValue = String(formData.get('salaryMax') ?? '');
    const appliedDate = String(formData.get('appliedDate') ?? '');
    const notes = String(formData.get('notes') ?? '').trim();

    if (
      salaryMinValue &&
      salaryMaxValue &&
      Number(salaryMinValue) > Number(salaryMaxValue)
    ) {
      setValidationError('Maximum salary must be at least the minimum salary.');
      return;
    }
    setValidationError(null);

    createMutation.mutate({
      companyName,
      jobTitle,
      ...(jobUrl ? { jobUrl } : {}),
      status: appliedDate ? 'APPLIED' : 'SAVED',
      ...(salaryMinValue ? { salaryMin: Number(salaryMinValue) } : {}),
      ...(salaryMaxValue ? { salaryMax: Number(salaryMaxValue) } : {}),
      ...(currency !== DEFAULT_CURRENCY ? { currency } : {}),
      ...(appliedDate ? { appliedDate } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      createMutation.reset();
      setValidationError(null);
      setCurrency(DEFAULT_CURRENCY);
    }
  }

  function handleImported(draft: OfferDraft) {
    if (formRef.current) fillForm(formRef.current, draft);
    setCurrency(draft.currency ?? DEFAULT_CURRENCY);
    setValidationError(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type='button'
        className='bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 text-white shadow-lg shadow-violet-500/30 transition-all hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-xl hover:shadow-violet-500/40 motion-safe:hover:-translate-y-0.5'
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden='true' />
        Add application
      </Button>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='text-ink!'>Add application</DialogTitle>
          <DialogDescription>
            Save a role and keep its details in one place.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className='space-y-5'>
          {!isDemoMode && <OfferImport onImported={handleImported} />}

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-2 sm:col-span-2'>
              <Label htmlFor='companyName'>Company</Label>
              <Input id='companyName' name='companyName' required />
            </div>

            <div className='grid gap-2 sm:col-span-2'>
              <Label htmlFor='jobTitle'>Job title</Label>
              <Input id='jobTitle' name='jobTitle' required />
            </div>

            <div className='grid gap-2 sm:col-span-2'>
              <Label htmlFor='jobUrl'>Job link</Label>
              <Input
                id='jobUrl'
                name='jobUrl'
                type='url'
                placeholder='https://'
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='salaryMin'>Minimum salary ({currency})</Label>
              <Input
                id='salaryMin'
                name='salaryMin'
                type='number'
                min='0.01'
                step='0.01'
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='salaryMax'>Maximum salary ({currency})</Label>
              <Input
                id='salaryMax'
                name='salaryMax'
                type='number'
                min='0.01'
                step='0.01'
              />
            </div>

            <div className='grid gap-2 sm:col-span-2'>
              <Label htmlFor='appliedDate'>Applied date</Label>
              <Input
                id='appliedDate'
                name='appliedDate'
                type='date'
                defaultValue={todayInputValue()}
              />
            </div>

            <div className='grid gap-2 sm:col-span-2'>
              <Label htmlFor='notes'>Notes</Label>
              <textarea
                id='notes'
                name='notes'
                rows={4}
                className='min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
              />
            </div>
          </div>

          {(validationError ?? createMutation.isError) && (
            <p role='alert' className='text-sm text-destructive'>
              {validationError ?? createMutation.error?.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save application'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
