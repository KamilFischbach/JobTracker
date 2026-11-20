import { hash, verify } from '@node-rs/argon2';

// OWASP's recommended minimum for Argon2id: 19 MiB memory, 2 iterations,
// 1 lane. Stored in the hash itself, so it can be raised later.
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hashes a password with Argon2id.
 *
 * @param {string} password  Plain-text password.
 * @returns {Promise<string>} PHC string with algorithm, parameters and salt.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Checks a password against a hash from {@link hashPassword}. A malformed
 * hash counts as a mismatch instead of throwing.
 *
 * @param {string} passwordHash  Stored hash.
 * @param {string} password      Password to check.
 * @returns {Promise<boolean>}   Whether they match.
 */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
