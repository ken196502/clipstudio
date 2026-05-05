import express, { Request, Response } from 'express';
import { db } from '../db/init';
import type { Job } from '../types';
import { AppError, asyncHandler } from '../middleware/error-handler';
import { listJobsForClient } from '../services/jobs-list';
import { notifyJobsChanged } from '../services/job-broadcast';

const router = express.Router();

// GET /api/jobs - Get all jobs (with optional status filter)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  const jobs = listJobsForClient(typeof status === 'string' ? status : undefined);
  res.json({ jobs });
}));

// GET /api/jobs/:id - Get job by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;

  if (!row) {
    throw new AppError(404, 'Job not found');
  }

  const job: Job = {
    id: row.id,
    kol_id: row.kol_id,
    video_id: row.video_id,
    stage: row.stage,
    status: row.status,
    progress: row.progress,
    error_message: row.error_message,
    started_at: row.started_at,
    completed_at: row.completed_at
  };

  res.json({ job });
}));

// POST /api/jobs/:id/retry - Retry failed job
router.post('/:id/retry', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  if (job.status !== 'failed') {
    throw new AppError(400, 'Only failed jobs can be retried');
  }

  // Reset job to running
  db.prepare(`
    UPDATE jobs
    SET status = 'running', progress = 0, error_message = NULL, started_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id);

  notifyJobsChanged(true);

  res.json({ message: 'Job retried successfully' });
}));

export default router;
