import type { PrismaClient } from '../../generated/prisma/client.js';
import type { UserWhereInput } from '../../generated/prisma/models.js';

/**
 * Deletes users with all their data. Applications, sessions and tokens go by
 * cascade; logged emails are deleted first, because they are kept (unlinked)
 * when only their application is deleted.
 *
 * @param {PrismaClient}   prisma  Database client.
 * @param {UserWhereInput} where   Which users to delete.
 * @returns {Promise<number>}      How many users were deleted.
 */
export async function deleteUsers(
  prisma: PrismaClient,
  where: UserWhereInput,
): Promise<number> {
  const [, { count }] = await prisma.$transaction([
    prisma.emailEvent.deleteMany({ where: { application: { user: where } } }),
    prisma.user.deleteMany({ where }),
  ]);
  return count;
}
