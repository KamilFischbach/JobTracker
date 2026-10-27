import { describe, expect, it } from 'vitest';
import type { ApplicationStatus } from '../../types/ApplicationStatus';
import type { JobApplicationType } from '../../types/JobApplication';
import { getApplicationStats } from '../application-stats';

function makeApplications(statuses: ApplicationStatus[]): JobApplicationType[] {
  return statuses.map((status, index) => ({
    id: `app-${index}`,
    companyName: 'Example Co',
    jobTitle: 'Frontend Developer',
    jobUrl: null,
    status,
    salaryMin: null,
    salaryMax: null,
    currency: 'PLN',
    appliedDate: null,
    notes: null,
  }));
}

describe('getApplicationStats', () => {
  it('counts each status and the response rate of sent applications', () => {
    const stats = getApplicationStats(
      makeApplications([
        'SAVED',
        'APPLIED',
        'APPLIED',
        'INTERVIEW_SCHEDULED',
        'OFFER',
        'REJECTED',
      ]),
    );

    expect(stats).toEqual({
      total: 6,
      sent: 5,
      responses: 3,
      responseRate: 60,
      interviews: 1,
      offers: 1,
    });
  });

  it('returns no response rate when nothing has been sent yet', () => {
    const stats = getApplicationStats(makeApplications(['SAVED', 'SAVED']));

    expect(stats.responseRate).toBeNull();
    expect(stats.total).toBe(2);
  });

  it('handles an empty list', () => {
    expect(getApplicationStats([])).toEqual({
      total: 0,
      sent: 0,
      responses: 0,
      responseRate: null,
      interviews: 0,
      offers: 0,
    });
  });
});
