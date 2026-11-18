import { describe, expect, it } from 'vitest';
import { buildDemoData } from '../../src/services/demo/demo-data.js';

describe('demo data', () => {
  it('gives every application to the user and links emails to them', () => {
    const { applications, emailEvents } = buildDemoData('user-1');
    const ids = new Set(applications.map((application) => application.id));

    expect(applications.length).toBeGreaterThan(0);
    expect(applications.every((application) => application.userId === 'user-1')).toBe(true);
    expect(ids.size).toBe(applications.length);
    expect(emailEvents.every((event) => ids.has(event.applicationId))).toBe(true);
  });

  it('makes copies for different users that share no ids', () => {
    const first = buildDemoData('user-1');
    const second = buildDemoData('user-2');

    const firstIds = [
      ...first.applications.map((application) => application.id),
      ...first.emailEvents.map((event) => event.gmailMessageId),
    ];
    const secondIds = [
      ...second.applications.map((application) => application.id),
      ...second.emailEvents.map((event) => event.gmailMessageId),
    ];
    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([]);
  });
});
