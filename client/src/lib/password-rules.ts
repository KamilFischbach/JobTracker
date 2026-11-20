/**
 * Quick checks before a new password is sent. The server has the full rules
 * (e.g. common passwords) and the final word; these only save a round trip.
 *
 * @param {string} password      New password.
 * @param {string} confirmation  The same password typed again.
 * @returns {string | null}      What is wrong, or null when it can be sent.
 */
export function newPasswordProblem(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < 12) return 'Use at least 12 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}

/**
 * Reads the `token` from a link like `/reset-password#token=…`. The token is
 * in the fragment so it is never sent to the server in page requests.
 *
 * @param {string} hash  `location.hash`, including `#`.
 * @returns {string | null} The token, or null when the link has none.
 */
export function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') || null;
}
