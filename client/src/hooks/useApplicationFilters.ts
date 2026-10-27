import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  parseFilterParams,
  toFilterParams,
  type ApplicationFilterState,
} from '../lib/application-filters';

/**
 * Filters live in the URL, so they survive a refresh, going to a card's
 * details and back, and can be bookmarked or shared.
 */
export function useApplicationFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseFilterParams(searchParams),
    [searchParams],
  );

  const updateFilters = useCallback(
    (patch: Partial<ApplicationFilterState>) => {
      // replace: typing in the search box should not add a history entry per key.
      setSearchParams(
        (current) =>
          toFilterParams({ ...parseFilterParams(current), ...patch }),
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { filters, updateFilters };
}
