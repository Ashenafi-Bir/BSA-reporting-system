// app.js
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import scheduleRoutes from './routes/schedules.js';
import logger from './config/logger.js';

const app = express();

app.use(cors());
app.use(express.json());

// Public auth routes FIRST
app.use('/api/auth', authRoutes);

// Authenticated routes
app.use('/api', apiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;