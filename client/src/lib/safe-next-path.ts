/**
 * Validates a `?next=` value from the URL so it can only lead to a page of
 * this app, never to another site (open redirect). Browsers treat `//host`
 * and `/\host` as links to another host.
 *
 * @param {string | null} next  Requested path.
 * @returns {string}            The path, or `/applications` when unsafe.
 */
export function safeNextPath(next: string | null): string {
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.startsWith('/\\')
  ) {
    return '/applications';
  }
  return next;
}
