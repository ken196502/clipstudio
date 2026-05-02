import express from 'express';
import { db } from '../db/init';
import type { Job } from '../types';
import { AppError, asyncHandler } from '../middleware/error-handler';

const router = express.Router();

// GET /api/jobs - Get all jobs (with optional status filter)
router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;

  let query = 'SELECT * FROM jobs ORDER BY started_at DESC';
  const params: any[] = [];

  if (status) {
    query = 'SELECT * FROM jobs WHERE status = ? ORDER BY started_at DESC';
    params.push(status);
  }

  const rows = db.prepare(query).all(...params) as any[];

  const jobs: Job[] = rows.map(row => ({
    id: row.id,
    kol_id: row.kol_id,
    video_id: row.video_id,
    stage: row.stage,
    status: row.status,
    progress: row.progress,
    error_message: row.error_message,
    started_at: row.started_at,
    completed_at: row.completed_at
  }));

  res.json({ jobs });
}));

// GET /api/jobs/:id - Get job by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);

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
router.post('/:id/retry', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);

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

  res.json({ message: 'Job retried successfully' });
}));

export default router;
