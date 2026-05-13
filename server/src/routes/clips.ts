import express, { Request, Response } from 'express';
import { db } from '../db/init';
import type { Clip, SearchRequest, SearchResponse } from '../types';
import { AppError, asyncHandler } from '../middleware/error-handler';
import { renderVerticalVideo, getVerticalVideoPath } from '../services/vertical-renderer';
import * as path from 'path';
import * as fs from 'fs';

const router = express.Router();

const CLIP_BASE = 'FROM clips LEFT JOIN videos AS v ON clips.video_id = v.id WHERE 1=1';

function mapClipRow(row: any): Clip {
  return {
    id: row.id,
    video_id: row.video_id,
    video_title: row.video_title ?? undefined,
    kol_name: row.kol_name,
    start_sec: row.start_sec,
    end_sec: row.end_sec,
    title: row.title,
    thumbnail: row.thumbnail,
    vertical_cover: row.vertical_cover ?? undefined,
    subtitles: row.subtitles ? JSON.parse(row.subtitles) : undefined,
    created_at: row.created_at,
  };
}

// In-memory store for render jobs
const renderJobs = new Map<number, {
  clipId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
}>();

let nextJobId = 1;

// GET /api/clips - Get all clips (with optional filters)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { kolName, sort = 'newest', limit = 50, offset = 0 } = req.query;

  const filterParams: any[] = [];
  let where = CLIP_BASE;

  if (kolName) {
    where += ' AND clips.kol_name = ?';
    filterParams.push(kolName);
  }

  let orderBy = ' ORDER BY clips.created_at DESC';
  if (sort === 'oldest') {
    orderBy = ' ORDER BY clips.created_at ASC';
  }

  const lim = parseInt(limit as string, 10);
  const off = parseInt(offset as string, 10);

  const listSql = `SELECT clips.*, v.title AS video_title ${where}${orderBy} LIMIT ? OFFSET ?`;
  const rows = db.prepare(listSql).all(...filterParams, lim, off) as any[];

  const clips: Clip[] = rows.map(mapClipRow);

  const countSql = `SELECT COUNT(*) AS n ${where}`;
  const total = (db.prepare(countSql).get(...filterParams) as any).n as number;

  res.json({ clips, total, limit: lim, offset: off });
}));

// GET /api/clips/:id - Get clip by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  const row = db
    .prepare(`SELECT clips.*, v.title AS video_title ${CLIP_BASE} AND clips.id = ?`)
    .get(id) as any;

  if (!row) {
    throw new AppError(404, 'Clip not found');
  }

  const clip: Clip = mapClipRow(row);
  res.json({ clip });
}));

// POST /api/clips/search - Search clips (keyword matching)
router.post('/search', asyncHandler(async (req: Request, res: Response) => {
  const { query, limit = 10 } = req.body as SearchRequest;

  if (!query || !query.trim()) {
    throw new AppError(400, 'Query is required');
  }

  const searchTerms = query.trim().toLowerCase().split(/\s+/);

  const rows = db.prepare(`SELECT clips.*, v.title AS video_title ${CLIP_BASE}`).all() as any[];

  const results = rows
    .map((row) => {
      const title = row.title.toLowerCase();
      // 搜索也匹配字幕内容
      const subtitleText = row.subtitles
        ? JSON.parse(row.subtitles).map((s: any) => s.text?.toLowerCase() || '').join(' ')
        : '';

      let relevance = 0;

      searchTerms.forEach((term) => {
        if (title.includes(term)) relevance += 30;
        if (subtitleText.includes(term)) relevance += 15;
      });

      return {
        clip: mapClipRow(row),
        relevance,
      };
    })
    .filter((result) => result.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit as number);

  const response: SearchResponse = { results };
  res.json(response);
}));

// POST /api/clips/vertical-render - Start vertical video render for a clip
router.post('/vertical-render', asyncHandler(async (req: Request, res: Response) => {
  const { clipId } = req.body as { clipId: number };

  if (!clipId || !Number.isFinite(clipId)) {
    throw new AppError(400, 'clipId is required');
  }

  // Check clip exists
  const row = db.prepare('SELECT * FROM clips WHERE id = ?').get(clipId) as any;
  if (!row) {
    throw new AppError(404, 'Clip not found');
  }

  // Check if already rendered
  const existingPath = getVerticalVideoPath(clipId);
  if (existingPath) {
    res.json({
      jobId: 0,
      status: 'completed',
      outputPath: existingPath,
    });
    return;
  }

  // Create render job
  const jobId = nextJobId++;
  renderJobs.set(jobId, {
    clipId,
    status: 'pending',
    progress: 0,
  });

  // Start render in background
  const clipData = {
    id: row.id,
    video_id: row.video_id,
    kol_name: row.kol_name,
    start_sec: row.start_sec,
    end_sec: row.end_sec,
    title: row.title,
    thumbnail: row.thumbnail,
    subtitles: row.subtitles ? JSON.parse(row.subtitles) : undefined,
  };

  processVerticalRender(jobId, clipData).catch((error) => {
    console.error(`[vertical-render] Job ${jobId} failed:`, error);
    const job = renderJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
  });

  res.json({
    jobId,
    status: 'pending',
  });
}));

// GET /api/clips/vertical-render/:jobId - Check render job status
router.get('/vertical-render/:jobId', asyncHandler(async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.jobId as string, 10);
  if (!Number.isFinite(jobId)) {
    throw new AppError(400, 'Invalid jobId');
  }

  const job = renderJobs.get(jobId);
  if (!job) {
    throw new AppError(404, 'Render job not found');
  }

  res.json({
    jobId,
    clipId: job.clipId,
    status: job.status,
    progress: job.progress,
    outputPath: job.outputPath,
    error: job.error,
  });
}));

// GET /api/clips/vertical-download/:filename - Download rendered vertical video
router.get('/vertical-download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.resolve(process.cwd(), 'storage', 'vertical-videos', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
  } catch (error) {
    console.error('Error downloading vertical video:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * Process vertical render job in background
 */
async function processVerticalRender(jobId: number, clipData: any): Promise<void> {
  const job = renderJobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'running';
    job.progress = 10;

    const outputPath = await renderVerticalVideo(clipData);

    job.status = 'completed';
    job.progress = 100;
    job.outputPath = outputPath;

    const outputFileName = path.basename(outputPath);
    db.prepare('UPDATE clips SET vertical_cover = ? WHERE id = ?').run(
      `/api/vertical-covers/${outputFileName}`,
      clipData.id
    );

    console.log(`[vertical-render] Job ${jobId} completed: ${outputPath}`);
  } catch (error: any) {
    job.status = 'failed';
    job.error = error?.message || 'Render failed';
    console.error(`[vertical-render] Job ${jobId} failed:`, error);
  }
}

export default router;
