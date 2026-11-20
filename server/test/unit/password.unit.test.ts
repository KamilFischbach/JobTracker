import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyPassword,
} from '../../src/services/auth/password.js';

describe('password hashing', () => {
  it('stores an Argon2id hash with a random salt, never the password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');

    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(first).not.toContain('correct horse');
    expect(first).not.toBe(second);
  });

  it('accepts the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse battery staple');

    expect(await verifyPassword(stored, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(stored, 'Correct horse battery staple')).toBe(false);
    expect(await verifyPassword(stored, '')).toBe(false);
  });

  it('treats a malformed stored hash as a mismatch', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});
