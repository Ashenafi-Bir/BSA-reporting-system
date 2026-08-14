import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import { initSchedulers } from './schedulers/cronJobs.js';
import logger from './config/logger.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

if (process.env.ENABLE_SCHEDULERS !== 'false') {
  initSchedulers();
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;