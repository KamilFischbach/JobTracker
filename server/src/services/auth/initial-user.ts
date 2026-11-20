import type { PrismaClient } from '../../generated/prisma/client.js';
import { hashPassword } from './password.js';

/**
 * Account created on start-up from `INITIAL_USER_EMAIL` / `INITIAL_USER_PASSWORD`.
 */
export interface InitialUser {
  email: string;
  password: string;
}

/**
 * Creates a verified account with the given email and password, so a
 * self-hosted instance can be used without the sign-up email. An existing
 * account is left as it is (its password is not overwritten).
 *
 * @param {PrismaClient} prisma   Database client.
 * @param {InitialUser}  initial  Email (already lower-cased) and password.
 * @returns {Promise<'created' | 'exists'>}  What happened.
 */
export async function ensureInitialUser(
  prisma: PrismaClient,
  { email, password }: InitialUser,
): Promise<'created' | 'exists'> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return 'exists';

  const passwordHash = await hashPassword(password);
  // upsert with an empty update tolerates two instances starting at once.
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, emailVerifiedAt: new Date() },
    update: {},
  });
  return 'created';
}
