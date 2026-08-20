import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import { initSchedulers } from './schedulers/cronJobs.js';
import logger from './config/logger.js';

const app = express();

app.use(cors());
app.use(express.json());

// Mount auth routes FIRST (before any authentication)
app.use('/api/auth', authRoutes);

// Then mount other routes that require authentication
app.use('/api', apiRoutes);
app.use('/api/users', userRoutes);

if (process.env.ENABLE_SCHEDULERS !== 'false') {
  initSchedulers();
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;