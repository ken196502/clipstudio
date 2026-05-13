import express, { Request, Response } from 'express';
import { db } from '../db/init';
import type { KOL, CreateKOLRequest, UpdateKOLRequest } from '../types';
import { processJob } from '../services/job-processor';
import { notifyJobsChanged } from '../services/job-broadcast';
import { AppError, asyncHandler } from '../middleware/error-handler';
import { extractChannelHandle } from '../services/youtube';

const router = express.Router();

function normalizeChannelUrl(input: string): string {
  return input.trim().replace(/\/+$/, '');
}

function deriveNameFromChannelUrl(channelUrl: string): string {
  const channelHandle = extractChannelHandle(channelUrl).trim();
  if (!channelHandle) return channelUrl;
  return channelHandle.replace(/^@/, '');
}

// GET /api/kols - Get all KOLs
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM kols ORDER BY created_at DESC').all() as any[];

  const kols: KOL[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    channel_url: row.channel_url,
    platform: row.platform,
    fetch_policy: row.fetch_policy ? JSON.parse(row.fetch_policy) : {},
    active: row.active,
    last_run: row.last_run,
    next_run: row.next_run,
    created_at: row.created_at
  }));

  res.json({ kols });
}));

// POST /api/kols - Create new KOL
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, channel_url, fetch_policy = {}, active = 1 } = req.body as CreateKOLRequest;

  if (!channel_url) {
    throw new AppError(400, 'channel_url is required');
  }

  const normalizedUrl = normalizeChannelUrl(channel_url);
  const resolvedName = (name || '').trim() || deriveNameFromChannelUrl(normalizedUrl);
  console.log('[kols:create] incoming payload:', {
    channel_url: normalizedUrl,
    hasName: Boolean(name),
    resolvedName,
  });

  // Idempotent create: if the channel already exists, update fields and return it.
  // This prevents duplicate rows and duplicate UI entries.
  const existing = db.prepare('SELECT * FROM kols WHERE channel_url = ?').get(normalizedUrl) as any;
  if (existing) {
    db.prepare(`
      UPDATE kols
      SET name = ?, fetch_policy = ?, active = ?
      WHERE id = ?
    `).run(
      resolvedName,
      JSON.stringify(fetch_policy),
      active,
      existing.id
    );

    const updated = db.prepare('SELECT * FROM kols WHERE id = ?').get(existing.id) as any;
    return res.status(200).json({
      id: updated.id,
      name: updated.name,
      channel_url: updated.channel_url,
      platform: updated.platform,
      fetch_policy: updated.fetch_policy ? JSON.parse(updated.fetch_policy) : {},
      active: updated.active,
      next_run: updated.next_run,
      created_at: updated.created_at
    });
  }

  const result = db.prepare(`
      INSERT INTO kols (name, channel_url, platform, fetch_policy, active)
      VALUES (?, ?, 'youtube', ?, ?)
    `).run(
    resolvedName,
    normalizedUrl,
    JSON.stringify(fetch_policy),
    active
  );

  const kol = db.prepare('SELECT * FROM kols WHERE id = ?').get(result.lastInsertRowid) as any;

  return res.status(201).json({
    id: kol.id,
    name: kol.name,
    channel_url: kol.channel_url,
    platform: kol.platform,
    fetch_policy: kol.fetch_policy ? JSON.parse(kol.fetch_policy) : {},
    active: kol.active,
    next_run: kol.next_run,
    created_at: kol.created_at
  });
}));

// PATCH /api/kols/:id - Update KOL
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
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
  if (updates.fetch_policy !== undefined) {
    updatesArray.push('fetch_policy = ?');
    values.push(JSON.stringify(updates.fetch_policy));
  }
  if (updates.active !== undefined) {
    updatesArray.push('active = ?');
    values.push(updates.active);
  }
  if (updates.last_run !== undefined) {
    updatesArray.push('last_run = ?');
    values.push(updates.last_run === null ? null : updates.last_run);
  }

  if (updatesArray.length === 0) {
    throw new AppError(400, 'No updates provided');
  }

  values.push(id);

  db.prepare(`
    UPDATE kols
    SET ${updatesArray.join(', ')}
    WHERE id = ?
  `).run(...values);

  const updated = db.prepare('SELECT * FROM kols WHERE id = ?').get(id) as any;

  res.json({
    id: updated.id,
    name: updated.name,
    channel_url: updated.channel_url,
    platform: updated.platform,
    fetch_policy: updated.fetch_policy ? JSON.parse(updated.fetch_policy) : {},
    active: updated.active,
    last_run: updated.last_run,
    next_run: updated.next_run,
    created_at: updated.created_at
  });
}));

// DELETE /api/kols/:id - Delete KOL
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  const result = db.prepare('DELETE FROM kols WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new AppError(404, 'KOL not found');
  }

  res.json({ message: 'KOL deleted successfully' });
}));

// POST /api/kols/:id/trigger - Manually trigger a job for a KOL
router.post('/:id/trigger', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  const kol = db.prepare('SELECT * FROM kols WHERE id = ?').get(id) as any;
  if (!kol) {
    throw new AppError(404, 'KOL not found');
  }

  const activeJob = db.prepare(`
    SELECT id
    FROM jobs
    WHERE kol_id = ?
      AND status IN ('running', 'pending')
    ORDER BY id DESC
    LIMIT 1
  `).get(id) as { id: number } | undefined;
  if (activeJob) {
    throw new AppError(409, `Job ${activeJob.id} is still active for this KOL`);
  }

  // Create a job entry
  const result = db.prepare(`
    INSERT INTO jobs (kol_id, status, stage, progress, started_at)
    VALUES (?, 'running', 'crawl', 0, ?)
  `).run(id, new Date().toISOString());

  const jobId = result.lastInsertRowid as number;

  // Start processing in background
  processJob(jobId).catch(error => {
    console.error(`Error processing job ${jobId}:`, error);
  });

  notifyJobsChanged(true);

  res.json({
    message: 'Job triggered successfully',
    jobId
  });
}));

export default router;
