import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db/init';
import kolsRouter from './routes/kols';
import jobsRouter from './routes/jobs';
import clipsRouter from './routes/clips';
import combineRouter from './routes/combine';
import luckyComboRouter from './routes/lucky-combo';
import { initializeQueues, closeQueues } from './services/queue';
import { startScheduler, stopScheduler } from './services/scheduler';
import { rateLimiter, strictRateLimiter } from './middleware/rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter); // Apply rate limiting to all routes

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/kols', kolsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/clips', clipsRouter);
app.use('/api/combine', strictRateLimiter, combineRouter);
app.use('/api/lucky-combo', strictRateLimiter, luckyComboRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL || './data/engine_vec.db'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize job queues
  try {
    initializeQueues();
  } catch (error) {
    console.error('Failed to initialize job queues:', error);
  }

  // Start scheduler
  try {
    startScheduler();
  } catch (error) {
    console.error('Failed to start scheduler:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopScheduler();
  await closeQueues();
  db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  stopScheduler();
  await closeQueues();
  db.close();
  process.exit(0);
});
