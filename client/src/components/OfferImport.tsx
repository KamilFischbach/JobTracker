import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import {
  type OfferDraft,
  OfferImportError,
  parseOffer,
} from '../services/applications';

type OfferImportProps = {
  onImported: (draft: OfferDraft) => void;
};

export function OfferImport({ onImported }: OfferImportProps) {
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);

  const importMutation = useMutation({
    mutationFn: parseOffer,
    onSuccess: (draft) => onImported(draft),
    onError: (error) => {
      // The site blocked the download: let the user paste the offer instead.
      if (error instanceof OfferImportError && error.code === 'FETCH_FAILED') {
        setShowPasteBox(true);
      }
    },
  });

  const trimmedUrl = url.trim();
  const canSubmit =
    Boolean(trimmedUrl) &&
    !importMutation.isPending &&
    (!showPasteBox || pastedText.trim().length > 0);

  function runImport() {
    if (!canSubmit) return;
    importMutation.mutate({
      url: trimmedUrl,
      ...(showPasteBox && pastedText.trim() ? { text: pastedText.trim() } : {}),
    });
  }

  // This sits inside the application form, so Enter must not submit it.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      runImport();
    }
  }

  return (
    <section
      aria-label='Import from link'
      className='space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4'
    >
      <div className='grid gap-2'>
        <Label htmlFor='offerUrl' className='flex items-center gap-1.5'>
          <Sparkles aria-hidden='true' className='size-4 text-violet-500' />
          Fill from job offer link
        </Label>
        <div className='flex gap-2'>
          <Input
            id='offerUrl'
            type='url'
            placeholder='https://nofluffjobs.com/pl/job/...'
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            type='button'
            onClick={runImport}
            disabled={!canSubmit}
            className='shrink-0'
          >
            {importMutation.isPending ? (
              <Loader2 aria-hidden='true' className='animate-spin' />
            ) : (
              <Sparkles aria-hidden='true' />
            )}
            {importMutation.isPending ? 'Reading...' : 'Fill with AI'}
          </Button>
        </div>
      </div>

      {showPasteBox && (
        <div className='grid gap-2'>
          <Label htmlFor='offerText'>
            Paste the offer text (the link stays saved with the application)
          </Label>
          <textarea
            id='offerText'
            rows={5}
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            className='min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
          />
        </div>
      )}

      <div aria-live='polite' className='text-sm'>
        {importMutation.isPending && (
          <p className='text-muted-foreground'>
            The local AI model is reading the offer. This can take up to a
            minute the first time.
          </p>
        )}
        {importMutation.isError && (
          <p role='alert' className='text-destructive'>
            {importMutation.error.message}
          </p>
        )}
        {importMutation.isSuccess &&
          (importMutation.data.warning ? (
            <p className='flex items-start gap-1.5 text-amber-600 dark:text-amber-400'>
              <TriangleAlert aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
              {importMutation.data.warning}
            </p>
          ) : (
            <p className='flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400'>
              <CheckCircle2 aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
              Form filled from the offer. Check the fields before saving.
            </p>
          ))}
      </div>
    </section>
  );
}
