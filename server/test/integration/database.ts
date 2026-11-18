import { readdir, readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const migrationsDir = new URL('../../prisma/migrations/', import.meta.url);

// Applies every Prisma migration in order, so new migrations are picked up
// without editing the tests.
export async function applyMigrations(connectionString: string) {
  const folders = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const folder of folders) {
      const sql = await readFile(
        new URL(`${folder}/migration.sql`, migrationsDir),
        'utf8',
      );
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

/**
 * Starts a throwaway PostgreSQL container with all migrations applied.
 *
 * @returns {Promise<{ prisma: PrismaClient; stop: () => Promise<void> }>}
 *   A client for it, and a function that disconnects and removes it.
 */
export async function startTestDatabase() {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('jobtracker_test')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  const connectionString = container.getConnectionUri();
  await applyMigrations(connectionString);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  return {
    prisma,
    async stop() {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
