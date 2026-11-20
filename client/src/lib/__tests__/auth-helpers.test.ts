import { describe, expect, it } from 'vitest';
import { newPasswordProblem, tokenFromHash } from '../password-rules';
import { safeNextPath } from '../safe-next-path';

describe('safeNextPath', () => {
  it.each(['/applications/abc', '/account', '/applications?status=OFFER'])(
    'keeps the app path %s',
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('replaces %s with the board', (path) => {
    expect(safeNextPath(path)).toBe('/applications');
  });
});

describe('newPasswordProblem', () => {
  it('accepts a long password typed twice', () => {
    expect(newPasswordProblem('correct horse battery', 'correct horse battery')).toBeNull();
  });

  it('asks for at least 12 and at most 128 characters', () => {
    expect(newPasswordProblem('short', 'short')).toBe('Use at least 12 characters.');
    const long = 'x'.repeat(129);
    expect(newPasswordProblem(long, long)).toBe('Use at most 128 characters.');
  });

  it('notices a mistyped repetition', () => {
    expect(newPasswordProblem('correct horse battery', 'correct horse batery')).toBe(
      'The passwords do not match.',
    );
  });
});

describe('tokenFromHash', () => {
  it('reads the token from the link fragment', () => {
    expect(tokenFromHash('#token=abc-123_X')).toBe('abc-123_X');
  });

  it('returns null when there is no token', () => {
    expect(tokenFromHash('')).toBeNull();
    expect(tokenFromHash('#token=')).toBeNull();
    expect(tokenFromHash('#other=1')).toBeNull();
  });
});
