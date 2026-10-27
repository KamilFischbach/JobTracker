import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { applyTheme, getCurrentTheme, type Theme } from '../lib/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

  function switchTheme() {
    const update = () => {
      // flushSync so the icon and the page colors change in the same frame.
      flushSync(() => setTheme(nextTheme));
      applyTheme(nextTheme);
    };

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (!document.startViewTransition || reduceMotion) {
      update();
      return;
    }

    // A short, soft crossfade between the old and new colors (timing in index.css).
    document.startViewTransition(update);
  }

  return (
    <button
      type='button'
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={`grid size-10 place-items-center overflow-hidden rounded-full bg-glass text-ink ring-1 ring-line backdrop-blur transition-colors hover:bg-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${className}`}
      onClick={switchTheme}
    >
      <AnimatePresence mode='wait' initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.9 }}
          className='grid place-items-center'
        >
          {theme === 'dark' ? (
            <Moon aria-hidden='true' className='size-4.5' />
          ) : (
            <Sun aria-hidden='true' className='size-4.5' />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
