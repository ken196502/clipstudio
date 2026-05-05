import './load-env';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { db } from './db/init';
import { getClipThumbnailsDir } from './services/clip-thumbnail';
import kolsRouter from './routes/kols';
import jobsRouter from './routes/jobs';
import clipsRouter from './routes/clips';
import combineRouter from './routes/combine';
import luckyComboRouter from './routes/lucky-combo';
import { startScheduler, stopScheduler } from './services/scheduler';
import { attachJobWebSocket, closeJobWebSocket } from './services/job-broadcast';
import { rateLimiter, strictRateLimiter } from './middleware/rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

const app = express();
const server = createServer(app);
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

app.use('/api/clip-thumbnails', express.static(getClipThumbnailsDir(), { fallthrough: true }));

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
if (process.env.NODE_ENV !== 'test') {
  attachJobWebSocket(server);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database: ${process.env.DATABASE_URL || './data/engine_vec.db'}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Scheduler: default on; set ENABLE_SCHEDULER=false to disable cron triggers
    if (process.env.ENABLE_SCHEDULER !== 'false') {
      try {
        startScheduler();
      } catch (error) {
        console.error('Failed to start scheduler:', error);
      }
    } else {
      console.warn('[Scheduler] Disabled (ENABLE_SCHEDULER=false)');
    }
  });
}

export { app, server };

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  closeJobWebSocket();
  stopScheduler();
  db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  closeJobWebSocket();
  stopScheduler();
  db.close();
  process.exit(0);
});
