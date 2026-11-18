import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './prisma.js';

const app = createApp({
  prisma,
  emailWebhook: {
    enabled: process.env.ENABLE_EMAIL_WEBHOOK === 'true',
    apiKey: process.env.WEBHOOK_API_KEY,
  },
});
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
