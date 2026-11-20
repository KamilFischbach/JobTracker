import type { PrismaClient } from '../../generated/prisma/client.js';
import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../../schemas/application.js';

/**
 * The user has no application with the given id (it does not exist or
 * belongs to someone else, which is not revealed). Answered with 404.
 */
export class ApplicationNotFoundError extends Error {
  constructor() {
    super('Application not found.');
  }
}

/**
 * An update would leave the maximum salary below the minimum. Answered with 400.
 */
export class InvalidSalaryRangeError extends Error {
  constructor() {
    super('Maximum salary must be at least the minimum salary.');
  }
}

type OmitUndefined<T> = {
  [Key in keyof T]: Exclude<T[Key], undefined>;
};

// Zod leaves absent optional fields as undefined, which Prisma's types reject
// with exactOptionalPropertyTypes; dropping them means "leave unchanged".
function omitUndefined<T extends object>(value: T): OmitUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as OmitUndefined<T>;
}

/**
 * Creates the service for the job applications on the board. Every function
 * takes the id of the logged-in user and only sees that user's applications.
 *
 * @param {PrismaClient} prisma  Database client.
 * @returns {ApplicationService} The service.
 */
export function createApplicationService(prisma: PrismaClient) {
  /**
   * @throws {ApplicationNotFoundError}
   */
  async function get(userId: string, id: string) {
    const application = await prisma.jobApplication.findFirst({
      where: { id, userId },
    });
    if (!application) throw new ApplicationNotFoundError();
    return application;
  }

  return {
    /** All applications, most recently applied first, unapplied last. */
    list(userId: string) {
      return prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { appliedDate: { sort: 'desc', nulls: 'last' } },
      });
    },

    get,

    /**
     * Emails the n8n workflow linked to the application, newest first.
     *
     * @throws {ApplicationNotFoundError}
     */
    async listEmailEvents(userId: string, applicationId: string) {
      await get(userId, applicationId);
      return prisma.emailEvent.findMany({
        where: { applicationId },
        orderBy: { receivedAt: 'desc' },
      });
    },

    create(userId: string, input: CreateApplicationInput) {
      return prisma.jobApplication.create({
        data: { ...omitUndefined(input), userId },
      });
    },

    /**
     * Changes the given fields. The salary range is checked against the
     * stored values too, e.g. a new maximum below the existing minimum.
     *
     * @throws {ApplicationNotFoundError | InvalidSalaryRangeError}
     */
    async update(userId: string, id: string, input: UpdateApplicationInput) {
      const existing = await get(userId, id);
      const data = omitUndefined(input);

      const salaryMin = data.salaryMin === undefined ? existing.salaryMin : data.salaryMin;
      const salaryMax = data.salaryMax === undefined ? existing.salaryMax : data.salaryMax;
      if (
        salaryMin !== null &&
        salaryMax !== null &&
        Number(salaryMin) > Number(salaryMax)
      ) {
        throw new InvalidSalaryRangeError();
      }

      // `get` checked the owner; the id alone is unique.
      return prisma.jobApplication.update({ where: { id }, data });
    },

    /**
     * @throws {ApplicationNotFoundError}
     */
    async remove(userId: string, id: string) {
      const { count } = await prisma.jobApplication.deleteMany({
        where: { id, userId },
      });
      if (count === 0) throw new ApplicationNotFoundError();
    },

    /**
     * Deletes the user's applications with the given ids; unknown ids and
     * other users' applications are skipped.
     *
     * @param {string}   userId  Owner of the applications.
     * @param {string[]} ids     Ids to delete.
     * @returns {Promise<number>}  How many were deleted.
     */
    async removeMany(userId: string, ids: string[]) {
      const { count } = await prisma.jobApplication.deleteMany({
        where: { id: { in: ids }, userId },
      });
      return count;
    },
  };
}

/**
 * The service created by {@link createApplicationService}.
 */
export type ApplicationService = ReturnType<typeof createApplicationService>;
