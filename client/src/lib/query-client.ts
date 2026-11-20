import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isUnauthenticated } from '../services/api-error';

/** Query key of the logged-in user (`null` when logged out). */
export const currentUserQueryKey = ['auth', 'me'] as const;

/**
 * Set when the user logged out on purpose (log out, account deleted), with an
 * optional notice for the login page. Without it, a missing session means it
 * expired, and the login page offers to come back (`?next=`).
 */
export const loggedOutQueryKey = ['auth', 'logged-out'] as const;

/** Data stored under {@link loggedOutQueryKey}. */
export type LoggedOut = { notice: string | null };

/**
 * The app's query client. When any request reports that the session is gone,
 * it drops all cached data and marks the user as logged out, which sends
 * them to the login page.
 *
 * @param {object} options  Extra defaults, e.g. `retry: false` in tests.
 * @returns {QueryClient}
 */
export function createQueryClient(
  options: ConstructorParameters<typeof QueryClient>[0] = {},
): QueryClient {
  const onError = (error: unknown) => {
    if (!isUnauthenticated(error)) return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== currentUserQueryKey[0],
    });
    queryClient.setQueryData(currentUserQueryKey, null);
  };

  const queryClient = new QueryClient({
    ...options,
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  });
  return queryClient;
}
