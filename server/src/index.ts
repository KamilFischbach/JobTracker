import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './prisma.js';

const app = createApp(prisma);
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
