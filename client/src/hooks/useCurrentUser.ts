import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  currentUserQueryKey,
  type LoggedOut,
  loggedOutQueryKey,
} from '../lib/query-client';
import { getCurrentUser } from '../services/auth';
import type { AuthUser } from '../types/AuthUser';

/**
 * The logged-in user: `undefined` while checking, `null` when logged out.
 *
 * @returns The query result for `GET /auth/me`.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Functions that switch the cached session after login or logout. Every
 * other cached query is removed, so no data of the previous user remains.
 * After `setLoggedOut`, the route guard sends the user to the login page.
 *
 * @returns {{ setLoggedIn: (user: AuthUser) => void; setLoggedOut: (notice?: string) => void }}
 */
export function useSessionCache() {
  const queryClient = useQueryClient();
  const reset = (user: AuthUser | null) => {
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== currentUserQueryKey[0],
    });
    queryClient.removeQueries({ queryKey: loggedOutQueryKey });
    queryClient.setQueryData(currentUserQueryKey, user);
  };
  return {
    setLoggedIn: (user: AuthUser) => reset(user),
    setLoggedOut: (notice?: string) => {
      queryClient.setQueryData<LoggedOut>(loggedOutQueryKey, {
        notice: notice ?? null,
      });
      // Set before the user, so the guard sees both in the same render.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== currentUserQueryKey[0],
      });
      queryClient.setQueryData(currentUserQueryKey, null);
    },
  };
}
