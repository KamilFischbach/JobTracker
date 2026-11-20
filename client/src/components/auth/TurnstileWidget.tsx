import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '../../lib/captcha';

type Turnstile = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: 'auto';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = TURNSTILE_SITE_KEY;
const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptLoading: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error('Turnstile did not load.'));
    script.onerror = () => {
      scriptLoading = undefined;
      reject(new Error('Turnstile did not load.'));
    };
    document.head.append(script);
  });
  return scriptLoading;
}

/**
 * Cloudflare Turnstile check. Reports a token when solved and `undefined`
 * when it expires. Tokens work once: change `resetKey` after each submit to
 * get a new one. Renders nothing when CAPTCHA is off.
 *
 * @param {object}   props
 * @param {Function} props.onToken   Receives the token, or undefined.
 * @param {number}   props.resetKey  Changing it resets the widget.
 */
export function TurnstileWidget({
  onToken,
  resetKey,
}: {
  onToken: (token: string | undefined) => void;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!SITE_KEY || !container.current) return;
    let cancelled = false;
    const element = container.current;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId.current = turnstile.render(element, {
          sitekey: SITE_KEY,
          theme: 'auto',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(undefined),
          'error-callback': () => onTokenRef.current(undefined),
        });
      })
      .catch(() => onTokenRef.current(undefined));

    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current) return;
    window.turnstile?.reset(widgetId.current);
    onTokenRef.current(undefined);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={container} className='min-h-16.5' />;
}
