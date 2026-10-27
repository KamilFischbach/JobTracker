export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'job-tracker-theme';

/** The theme currently on the page (set before React loads, see index.html). */
export function getCurrentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  // Native controls (date pickers, select menus, scrollbars) follow this.
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (e.g. private mode); the theme still applies for this visit.
  }
}
