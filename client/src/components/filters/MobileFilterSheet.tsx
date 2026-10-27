import { Dialog } from '@base-ui/react/dialog';
import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { fieldLabel } from './FilterControls';

/** Phone-sized filter panel that slides up from the bottom of the screen. */
export function MobileFilterSheet({
  activeCount,
  resultCount,
  onClearAll,
  children,
}: {
  activeCount: number;
  resultCount: number;
  onClearAll: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className='relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-glass px-3 text-sm font-medium text-ink transition-colors hover:bg-glass-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'>
        <SlidersHorizontal aria-hidden='true' className='size-4' />
        Filters
        {activeCount > 0 && (
          <span className='grid size-5 place-items-center rounded-full bg-indigo-500 text-[0.7rem] font-semibold text-white tabular-nums'>
            {activeCount}
          </span>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className='fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs dark:bg-slate-950/60 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0' />
        <Dialog.Popup className='fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col rounded-t-3xl bg-popover shadow-2xl shadow-black/20 ring-1 ring-line dark:shadow-black/60 outline-none transition-transform duration-300 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full'>
          <div
            aria-hidden='true'
            className='mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line-strong'
          />
          <div className='flex items-center justify-between px-5 pt-3 pb-2'>
            <Dialog.Title className='m-0! text-lg! font-semibold! text-ink!'>
              Filters
            </Dialog.Title>
            <Dialog.Close
              aria-label='Close filters'
              className='grid size-8 place-items-center rounded-full text-ink-subtle hover:bg-line hover:text-ink'
            >
              <X aria-hidden='true' className='size-4' />
            </Dialog.Close>
          </div>
          <div className='grid gap-5 overflow-y-auto px-5 py-3'>{children}</div>
          <div className='flex items-center gap-3 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
            <button
              type='button'
              className='h-11 rounded-xl px-4 text-sm font-medium text-ink-muted hover:bg-line disabled:opacity-40'
              disabled={activeCount === 0}
              onClick={onClearAll}
            >
              Clear all
            </button>
            <Dialog.Close className='h-11 flex-1 rounded-xl bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/30'>
              Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A labelled block inside the sheet. */
export function SheetSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='grid gap-2'>
      <h3 className={`${fieldLabel} m-0`}>{title}</h3>
      {children}
    </section>
  );
}
