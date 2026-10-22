import { describe, expect, it } from 'vitest';
import type { JobApplicationType } from '../../types/JobApplication';
import { filterAndSortApplications } from '../application-list';

function makeApplication(
  overrides: Partial<JobApplicationType> & Pick<JobApplicationType, 'id'>,
): JobApplicationType {
  return {
    companyName: 'Example Co',
    jobTitle: 'Frontend Developer',
    jobUrl: null,
    status: 'APPLIED',
    salaryMin: null,
    salaryMax: null,
    currency: 'PLN',
    appliedDate: null,
    notes: null,
    ...overrides,
    id: overrides.id,
  };
}

const defaultFilters = {
  searchText: '',
  appliedAfter: '',
  appliedBefore: '',
  sortBy: 'applied-newest' as const,
};

describe('filterAndSortApplications', () => {
  const applications = [
    makeApplication({
      id: 'older',
      companyName: 'Willow Systems',
      appliedDate: new Date('2026-09-10T00:00:00'),
      salaryMax: 14000,
    }),
    makeApplication({
      id: 'newer',
      companyName: 'Acorn Labs',
      jobTitle: 'React Engineer',
      appliedDate: new Date('2026-10-10T00:00:00'),
      salaryMax: 18000,
      notes: 'Referred by a former colleague',
    }),
    makeApplication({ id: 'undated', companyName: 'Birch Studio' }),
  ];

  it('searches company, job title, and notes without case sensitivity', () => {
    const results = filterAndSortApplications(applications, {
      ...defaultFilters,
      searchText: 'FORMER COLLEAGUE',
    });

    expect(results.map((application) => application.id)).toEqual(['newer']);
  });

  it('includes both ends of the applied-date range and excludes undated applications', () => {
    const results = filterAndSortApplications(applications, {
      ...defaultFilters,
      appliedAfter: '2026-09-10',
      appliedBefore: '2026-10-10',
    });

    expect(new Set(results.map((application) => application.id))).toEqual(
      new Set(['older', 'newer']),
    );
  });

  it('sorts by company name alphabetically', () => {
    const results = filterAndSortApplications(applications, {
      ...defaultFilters,
      sortBy: 'company',
    });

    expect(results.map((application) => application.companyName)).toEqual([
      'Acorn Labs',
      'Birch Studio',
      'Willow Systems',
    ]);
  });

  it('sorts salary high-to-low and places applications without a salary last', () => {
    const results = filterAndSortApplications(applications, {
      ...defaultFilters,
      sortBy: 'salary-high',
    });

    expect(results.map((application) => application.id)).toEqual([
      'newer',
      'older',
      'undated',
    ]);
  });
});
