import { createHmac } from 'node:crypto';
import ipaddr from 'ipaddr.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AuthUser } from '../auth/session-service.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Daily (rolling 24 h) caps on "Fill with AI", protecting the shared LLM quota.
 */
export type AiLimits = {
  /** Per registered user. */
  perUser: number;
  /** Per client address, for demo accounts. */
  perDemoIp: number;
  /** All demo accounts together. */
  demoTotal: number;
  /** Everyone together; keep it below the provider's daily request limit. */
  total: number;
};

/** Defaults; `index.ts` may override them from the config. */
export const DEFAULT_AI_LIMITS: AiLimits = {
  perUser: 20,
  perDemoIp: 3,
  demoTotal: 50,
  total: 500,
};

/**
 * A daily AI limit is used up. Answered with 429.
 */
export class AiLimitReachedError extends Error {}

/**
 * Pseudonymous key for a client address: an HMAC, so raw IPs are never
 * stored. IPv6 addresses are cut to their /64 network, because one household
 * usually gets a whole /64 and could otherwise pick a new address per request.
 *
 * @param {string | undefined} ip      Client address (`request.ip`).
 * @param {string}             secret  Server secret for the HMAC.
 * @returns {string}                   Hex key.
 */
export function ipKey(ip: string | undefined, secret: string): string {
  let network = 'unknown';
  if (ip && ipaddr.isValid(ip)) {
    const address = ipaddr.process(ip);
    network =
      address.kind() === 'ipv6'
        ? `${(address as ipaddr.IPv6).parts.slice(0, 4).join(':')}::/64`
        : address.toString();
  }
  return createHmac('sha256', secret).update(network).digest('hex').slice(0, 32);
}

/**
 * Creates the service that counts AI imports against {@link AiLimits}.
 *
 * @param {object}       deps
 * @param {PrismaClient} deps.prisma        Database client.
 * @param {AiLimits}     deps.limits        Daily caps.
 * @param {string}       deps.ipHashSecret  Secret for {@link ipKey}.
 * @param {() => Date}   deps.now           Clock, replaceable in tests.
 * @returns {AiUsageService}                The service.
 */
export function createAiUsageService({
  prisma,
  limits,
  ipHashSecret,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  limits: AiLimits;
  ipHashSecret: string;
  now?: () => Date;
}) {
  const since = () => ({ gt: new Date(now().getTime() - WINDOW_MS) });

  // The limit that applies to this user personally, and how much of it is used.
  async function personal(user: AuthUser, key: string) {
    return user.isDemo
      ? {
          used: await prisma.aiUsage.count({
            where: { isDemo: true, ipKey: key, createdAt: since() },
          }),
          limit: limits.perDemoIp,
        }
      : {
          used: await prisma.aiUsage.count({
            where: { userId: user.id, createdAt: since() },
          }),
          limit: limits.perUser,
        };
  }

  return {
    /**
     * How many AI imports the user has used and may use today.
     *
     * @param {AuthUser}           user  Logged-in user.
     * @param {string | undefined} ip    Client address.
     * @returns {Promise<{ used: number; limit: number }>}
     */
    async getUsage(user: AuthUser, ip: string | undefined) {
      const { used, limit } = await personal(user, ipKey(ip, ipHashSecret));
      return { used: Math.min(used, limit), limit };
    },

    /**
     * Counts one AI import, or refuses it when a limit is used up. The row is
     * written first and counted after, so two requests at once cannot both
     * take the last free slot.
     *
     * @param {AuthUser}           user  Logged-in user.
     * @param {string | undefined} ip    Client address.
     * @returns {Promise<() => Promise<void>>} Gives the import back, for
     *   failures that did not use the LLM (e.g. the provider was down).
     * @throws {AiLimitReachedError} When a limit is used up.
     */
    async reserve(user: AuthUser, ip: string | undefined) {
      const key = ipKey(ip, ipHashSecret);
      const row = await prisma.aiUsage.create({
        data: { userId: user.id, isDemo: user.isDemo, ipKey: key },
      });
      const release = async () => {
        await prisma.aiUsage.deleteMany({ where: { id: row.id } });
      };

      const own = await personal(user, key);
      const demoTotal = user.isDemo
        ? await prisma.aiUsage.count({ where: { isDemo: true, createdAt: since() } })
        : 0;
      const total = await prisma.aiUsage.count({ where: { createdAt: since() } });

      let message: string | null = null;
      if (own.used > own.limit) {
        message = user.isDemo
          ? `The demo allows ${own.limit} AI imports per day. Create a free account for more.`
          : `You have used all ${own.limit} AI imports for today. More become available within 24 hours.`;
      } else if (demoTotal > limits.demoTotal || total > limits.total) {
        message = 'The AI import has reached its daily limit. Try again tomorrow.';
      }
      if (message) {
        await release();
        throw new AiLimitReachedError(message);
      }
      return release;
    },
  };
}

/**
 * The service created by {@link createAiUsageService}.
 */
export type AiUsageService = ReturnType<typeof createAiUsageService>;
