import express from 'express';
import { db } from '../db/init';
import type { KOL, CreateKOLRequest, UpdateKOLRequest } from '../types';
import { processJob } from '../services/job-processor';
import { AppError, asyncHandler } from '../middleware/error-handler';

const router = express.Router();

// GET /api/kols - Get all KOLs
router.get('/', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM kols ORDER BY created_at DESC').all() as any[];

  const kols: KOL[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    channel_url: row.channel_url,
    platform: row.platform,
    tags: row.tags ? JSON.parse(row.tags) : [],
    fetch_policy: row.fetch_policy ? JSON.parse(row.fetch_policy) : {},
    active: row.active,
    last_run: row.last_run,
    next_run: row.next_run,
    created_at: row.created_at
  }));

  res.json({ kols });
}));

// POST /api/kols - Create new KOL
router.post('/', asyncHandler(async (req, res) => {
  const { name, channel_url, tags = [], fetch_policy = {}, active = 1 } = req.body as CreateKOLRequest;

  if (!name || !channel_url) {
    throw new AppError(400, 'name and channel_url are required');
  }

  const result = db.prepare(`
    INSERT INTO kols (name, channel_url, platform, tags, fetch_policy, active)
    VALUES (?, ?, 'youtube', ?, ?, ?)
  `).run(
    name,
    channel_url,
    JSON.stringify(tags),
    JSON.stringify(fetch_policy),
    active
  );

  const kol = db.prepare('SELECT * FROM kols WHERE id = ?').get(result.lastInsertRowid) as any;

  res.status(201).json({
    id: kol.id,
    name: kol.name,
    channel_url: kol.channel_url,
    platform: kol.platform,
    tags: kol.tags ? JSON.parse(kol.tags) : [],
    fetch_policy: kol.fetch_policy ? JSON.parse(kol.fetch_policy) : {},
    active: kol.active,
    next_run: kol.next_run,
    created_at: kol.created_at
  });
}));

// PATCH /api/kols/:id - Update KOL
router.patch('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const updates: UpdateKOLRequest = req.body;

  const existing = db.prepare('SELECT * FROM kols WHERE id = ?').get(id) as any;
  if (!existing) {
    throw new AppError(404, 'KOL not found');
  }

  const updatesArray: any[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    updatesArray.push('name = ?');
    values.push(updates.name);
  }
  if (updates.channel_url !== undefined) {
    updatesArray.push('channel_url = ?');
    values.push(updates.channel_url);
  }
  if (updates.tags !== undefined) {
    updatesArray.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.fetch_policy !== undefined) {
    updatesArray.push('fetch_policy = ?');
    values.push(JSON.stringify(updates.fetch_policy));
  }
  if (updates.active !== undefined) {
    updatesArray.push('active = ?');
    values.push(updates.active);
  }

  if (updatesArray.length === 0) {
    throw new AppError(400, 'No updates provided');
  }

  values.push(id);
  const query = `UPDATE kols SET ${updatesArray.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...values);

  const updated = db.prepare('SELECT * FROM kols WHERE id = ?').get(id) as any;

  res.json({
    id: updated.id,
    name: updated.name,
    channel_url: updated.channel_url,
    platform: updated.platform,
    tags: updated.tags ? JSON.parse(updated.tags) : [],
    fetch_policy: updated.fetch_policy ? JSON.parse(updated.fetch_policy) : {},
    active: updated.active,
    last_run: updated.last_run,
    next_run: updated.next_run,
    created_at: updated.created_at
  });
}));

// POST /api/kols/:id/trigger - Trigger manual job
router.post('/:id/trigger', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);

  const kol = db.prepare('SELECT * FROM kols WHERE id = ?').get(id) as any;
  if (!kol) {
    throw new AppError(404, 'KOL not found');
  }

  if (kol.active !== 1) {
    throw new AppError(400, 'KOL is not active');
  }

  // Create a new job
  const result = db.prepare(`
    INSERT INTO jobs (kol_id, stage, status, progress, started_at)
    VALUES (?, 'crawl', 'running', 0, ?)
  `).run(id, new Date().toISOString());

  // Update last_run
  db.prepare('UPDATE kols SET last_run = ? WHERE id = ?').run(new Date().toISOString(), id);

  // Start processing the job asynchronously
  const jobId = result.lastInsertRowid as number;
  processJob(jobId).catch(error => {
    console.error(`Failed to process job ${jobId}:`, error);
  });

  res.json({
    jobId: result.lastInsertRowid,
    status: 'running',
    message: 'Job started successfully'
  });
}));

export default router;
