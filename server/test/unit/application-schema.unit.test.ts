import { describe, expect, it } from 'vitest';
import {
  createApplicationSchema,
  deleteApplicationsSchema,
  updateApplicationSchema,
} from '../../src/schemas/application.js';

const validApplication = {
  companyName: 'Acorn Labs',
  jobTitle: 'Frontend Engineer',
  salaryMin: 12000,
  salaryMax: 16000,
  appliedDate: '2026-10-15',
};

describe('application request schemas', () => {
  it('trims required text and transforms the applied date', () => {
    const result = createApplicationSchema.safeParse({
      ...validApplication,
      companyName: '  Acorn Labs  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyName).toBe('Acorn Labs');
      expect(result.data.appliedDate).toEqual(
        new Date('2026-10-15T00:00:00.000Z'),
      );
    }
  });

  it('rejects missing required text and inverted salary ranges', () => {
    expect(
      createApplicationSchema.safeParse({
        ...validApplication,
        companyName: ' ',
      }).success,
    ).toBe(false);
    expect(
      createApplicationSchema.safeParse({
        ...validApplication,
        salaryMin: 18000,
        salaryMax: 16000,
      }).success,
    ).toBe(false);
  });

  it('accepts only http(s) job links', () => {
    for (const jobUrl of [
      'https://example.com/jobs/1',
      'http://example.com/jobs/1',
      null,
    ]) {
      expect(
        createApplicationSchema.safeParse({ ...validApplication, jobUrl })
          .success,
      ).toBe(true);
    }

    for (const jobUrl of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/job',
    ]) {
      expect(
        createApplicationSchema.safeParse({ ...validApplication, jobUrl })
          .success,
      ).toBe(false);
      expect(updateApplicationSchema.safeParse({ jobUrl }).success).toBe(false);
    }
  });

  it('allows a valid partial status update and rejects an empty update', () => {
    expect(updateApplicationSchema.safeParse({ status: 'OFFER' }).success).toBe(
      true,
    );
    expect(updateApplicationSchema.safeParse({}).success).toBe(false);
    expect(
      updateApplicationSchema.safeParse({ status: 'UNKNOWN' }).success,
    ).toBe(false);
  });

  it('requires unique non-empty ids for batch delete', () => {
    expect(
      deleteApplicationsSchema.safeParse({ ids: ['one', 'two'] }).success,
    ).toBe(true);
    expect(deleteApplicationsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(
      deleteApplicationsSchema.safeParse({ ids: ['one', 'one'] }).success,
    ).toBe(false);
  });
});
