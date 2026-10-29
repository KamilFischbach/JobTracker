import { describe, expect, it } from 'vitest';
import {
  isSameCompany,
  matchApplication,
  nextStatus,
} from '../../src/email/email-status.js';

describe('nextStatus', () => {
  it('moves applications forward', () => {
    expect(nextStatus('APPLICATION_RECEIVED', 'SAVED')).toBe('APPLIED');
    expect(nextStatus('INTERVIEW_INVITATION', 'APPLIED')).toBe(
      'INTERVIEW_SCHEDULED',
    );
    expect(nextStatus('REJECTION', 'INTERVIEW_SCHEDULED')).toBe('REJECTED');
    expect(nextStatus('OFFER', 'INTERVIEW_SCHEDULED')).toBe('OFFER');
  });

  it('never moves backwards or reopens closed applications', () => {
    expect(nextStatus('APPLICATION_RECEIVED', 'INTERVIEW_SCHEDULED')).toBeNull();
    expect(nextStatus('INTERVIEW_INVITATION', 'INTERVIEW_SCHEDULED')).toBeNull();
    expect(nextStatus('INTERVIEW_INVITATION', 'REJECTED')).toBeNull();
    expect(nextStatus('REJECTION', 'OFFER')).toBeNull();
    expect(nextStatus('NOT_JOB_RELATED', 'APPLIED')).toBeNull();
  });
});

describe('isSameCompany', () => {
  it.each([
    ['Box', 'Box Inc.'],
    ['CLOUDFIDE SP. Z.O.O', 'Cloudfide'],
    ['Motorola Solutions', 'Motorola Solutions Systems Polska Sp. z o.o.'],
    ['Solutions 4 Delivery B.V. Oddział w Polsce', 'Solutions 4 Delivery'],
    ['Łódź Software', 'Lodz software'],
  ])('matches %s with %s', (a, b) => {
    expect(isSameCompany(a, b)).toBe(true);
  });

  it.each([
    ['Box', 'Dropbox'],
    ['Acorn Labs', 'Cedar Cloud'],
    ['Sp. z o.o.', 'Acorn Labs Sp. z o.o.'],
  ])('does not match %s with %s', (a, b) => {
    expect(isSameCompany(a, b)).toBe(false);
  });
});

describe('matchApplication', () => {
  const applications = [
    { id: '1', companyName: 'Acorn Labs', jobTitle: 'Frontend Engineer', status: 'APPLIED' as const },
    { id: '2', companyName: 'Acorn Labs', jobTitle: 'Data Analyst', status: 'APPLIED' as const },
    { id: '3', companyName: 'Cedar Cloud', jobTitle: 'QA Engineer', status: 'REJECTED' as const },
    { id: '4', companyName: 'Cedar Cloud', jobTitle: 'QA Engineer', status: 'SAVED' as const },
  ];

  it('uses the job title when a company has several applications', () => {
    expect(
      matchApplication(applications, {
        companyName: 'Acorn Labs Sp. z o.o.',
        jobTitle: 'Senior Frontend Engineer',
      }),
    ).toMatchObject({ kind: 'match', application: { id: '1' } });
  });

  it('asks for review when the job title does not decide', () => {
    expect(
      matchApplication(applications, { companyName: 'Acorn Labs', jobTitle: null }),
    ).toMatchObject({ kind: 'ambiguous' });
  });

  it('prefers the application that is still open', () => {
    expect(
      matchApplication(applications, { companyName: 'Cedar Cloud', jobTitle: null }),
    ).toMatchObject({ kind: 'match', application: { id: '4' } });
  });

  it('reports no match for unknown or missing companies', () => {
    expect(
      matchApplication(applications, { companyName: 'Birch AI', jobTitle: null }),
    ).toEqual({ kind: 'none' });
    expect(
      matchApplication(applications, { companyName: null, jobTitle: 'QA' }),
    ).toEqual({ kind: 'none' });
  });
});
