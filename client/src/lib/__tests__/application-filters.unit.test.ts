import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES } from '../../types/ApplicationStatus';
import {
  countActiveFilters,
  getActiveDatePreset,
  getDatePresetRange,
  parseFilterParams,
  toFilterParams,
  toggleStatusFilter,
  type ApplicationFilterState,
} from '../application-filters';

const defaults: ApplicationFilterState = {
  searchText: '',
  appliedAfter: '',
  appliedBefore: '',
  sortBy: 'applied-newest',
  statuses: [...APPLICATION_STATUSES],
};

describe('filter URL params', () => {
  it('uses defaults for an empty URL and writes nothing back', () => {
    const filters = parseFilterParams(new URLSearchParams());

    expect(filters).toEqual(defaults);
    expect(toFilterParams(filters).toString()).toBe('');
  });

  it('round-trips every filter through the URL', () => {
    const filters: ApplicationFilterState = {
      searchText: 'acme',
      appliedAfter: '2026-10-01',
      appliedBefore: '2026-10-20',
      sortBy: 'company',
      statuses: ['APPLIED', 'INTERVIEW_SCHEDULED'],
    };

    const params = toFilterParams(filters);

    expect(params.get('status')).toBe('applied,interview');
    expect(parseFilterParams(params)).toEqual(filters);
  });

  it('ignores invalid values', () => {
    const filters = parseFilterParams(
      new URLSearchParams('from=yesterday&sort=random&status=unknown'),
    );

    expect(filters).toEqual(defaults);
  });
});

describe('countActiveFilters', () => {
  it('counts search, date range and statuses, but not sort', () => {
    expect(countActiveFilters({ ...defaults, sortBy: 'company' })).toBe(0);
    expect(
      countActiveFilters({
        ...defaults,
        searchText: 'acme',
        appliedAfter: '2026-10-01',
        appliedBefore: '2026-10-20',
        statuses: ['OFFER'],
      }),
    ).toBe(3);
  });
});

describe('date presets', () => {
  const today = new Date(2026, 9, 27); // 27 Oct 2026

  it('builds ranges that end today', () => {
    expect(getDatePresetRange('last-7-days', today)).toEqual({
      appliedAfter: '2026-10-21',
      appliedBefore: '2026-10-27',
    });
    expect(getDatePresetRange('last-30-days', today)).toEqual({
      appliedAfter: '2026-09-28',
      appliedBefore: '2026-10-27',
    });
    expect(getDatePresetRange('this-month', today)).toEqual({
      appliedAfter: '2026-10-01',
      appliedBefore: '2026-10-27',
    });
  });

  it('recognises when the current range matches a preset', () => {
    expect(
      getActiveDatePreset(
        { appliedAfter: '2026-10-01', appliedBefore: '2026-10-27' },
        today,
      ),
    ).toBe('this-month');
    expect(
      getActiveDatePreset(
        { appliedAfter: '2026-10-02', appliedBefore: '2026-10-27' },
        today,
      ),
    ).toBeNull();
  });
});

describe('toggleStatusFilter', () => {
  const all = [...APPLICATION_STATUSES];

  it('shows only the pressed status when nothing is filtered', () => {
    expect(toggleStatusFilter(all, 'OFFER')).toEqual(['OFFER']);
  });

  it('adds statuses in board order and removes pressed ones', () => {
    expect(toggleStatusFilter(['OFFER'], 'APPLIED')).toEqual([
      'APPLIED',
      'OFFER',
    ]);
    expect(toggleStatusFilter(['APPLIED', 'OFFER'], 'OFFER')).toEqual([
      'APPLIED',
    ]);
  });

  it('goes back to every status when the last one is removed', () => {
    expect(toggleStatusFilter(['OFFER'], 'OFFER')).toEqual(all);
  });
});
