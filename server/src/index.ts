import 'dotenv/config';

import express from 'express';
import applicationsRouter from './routes/applications.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use('/applications', applicationsRouter);
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
