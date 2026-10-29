import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';

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
