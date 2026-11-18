// Creates the local demo user and gives it fictional applications.
//
//   pnpm --filter server db:seed         adds the data only if the demo user has none
//   pnpm --filter server db:seed:reset   replaces the demo user's applications and emails
//
// The password is DEMO_USER_PASSWORD from server/.env, or a random one that is
// printed when the user is created. Other users' data is never touched.
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/prisma.js';
import { hashPassword } from '../src/services/auth/password.js';
import { buildDemoData } from '../src/services/demo/demo-data.js';

const DEMO_EMAIL = 'demo@jobtracker.local';

async function findOrCreateDemoUser() {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });
  if (existing) return existing;

  const password =
    process.env.DEMO_USER_PASSWORD || randomBytes(12).toString('base64url');
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Created ${DEMO_EMAIL}.`);
  if (!process.env.DEMO_USER_PASSWORD) {
    console.log(`Password (shown once): ${password}`);
  }
  return user;
}

async function main() {
  const reset = process.argv.includes('--reset');
  const user = await findOrCreateDemoUser();
  const existing = await prisma.jobApplication.count({
    where: { userId: user.id },
  });

  if (existing > 0 && !reset) {
    console.log(
      `${DEMO_EMAIL} already has ${existing} applications, so nothing was added.\n` +
        'Run "pnpm --filter server db:seed:reset" to replace them with the demo data.',
    );
    return;
  }

  const { applications, emailEvents } = buildDemoData(user.id);
  await prisma.$transaction([
    // Emails stay when their application is deleted, so remove them first.
    prisma.emailEvent.deleteMany({ where: { application: { userId: user.id } } }),
    prisma.jobApplication.deleteMany({ where: { userId: user.id } }),
    prisma.jobApplication.createMany({ data: applications }),
    prisma.emailEvent.createMany({ data: emailEvents }),
  ]);

  console.log(
    `Loaded ${applications.length} applications and ${emailEvents.length} email events for ${DEMO_EMAIL}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
