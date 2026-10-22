import { Separator } from '@/components/ui/separator';
import { ArrowUpRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className='w-full bg-[#f4f4f5] py-16 px-6 text-sm'>
      <div className='mx-auto max-w-5xl'>
        <h2 className='mb-12 text-black! text-center text-6xl font-bold tracking-tight md:text-8xl'>
          Kamil Fischbach
        </h2>

        <Separator className='mb-8 bg-zinc-200' />

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='flex flex-col items-center gap-4'>
            <span className='text-xs font-semibold uppercase tracking-wide text-black'>
              Email
            </span>
            <a
              href='mailto:example@shadcnblocks.com'
              className='flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors'
            >
              fischbach.kamil@gmail.com <ArrowUpRight className='h-3 w-3' />
            </a>
          </div>

          <div className='flex flex-col items-center gap-4'>
            <span className='text-xs font-semibold uppercase tracking-wide text-black'>
              Find me
            </span>
            <div className='flex gap-4 text-zinc-500'>
              <a
                href='https://www.linkedin.com/in/kamil-fischbach-288175253/'
                className='hover:text-zinc-900 transition-colors'
              >
                LinkedIn
              </a>
              <a
                href='https://github.com/KamilFischbach/JobTracker'
                className='hover:text-zinc-900 transition-colors'
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
