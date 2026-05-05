import express, { Request, Response } from 'express';
import { db } from '../db/init';
import type { Clip, SearchRequest, SearchResponse } from '../types';
import { AppError, asyncHandler } from '../middleware/error-handler';

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
    summary: row.summary,
    keywords: row.keywords ? JSON.parse(row.keywords) : [],
    topic_category: row.topic_category,
    thumbnail: row.thumbnail,
    created_at: row.created_at,
  };
}

// GET /api/clips - Get all clips (with optional filters)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { kolName, category, sort = 'newest', limit = 50, offset = 0 } = req.query;

  const filterParams: any[] = [];
  let where = CLIP_BASE;

  if (kolName) {
    where += ' AND clips.kol_name = ?';
    filterParams.push(kolName);
  }

  if (category) {
    where += ' AND clips.topic_category = ?';
    filterParams.push(category);
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
      const summary = row.summary?.toLowerCase() || '';
      const keywords = row.keywords ? JSON.parse(row.keywords).map((k: string) => k.toLowerCase()) : [];

      let relevance = 0;

      searchTerms.forEach((term) => {
        if (title.includes(term)) relevance += 30;
        if (summary.includes(term)) relevance += 20;
        if (keywords.some((k: string) => k.includes(term))) relevance += 10;
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

export default router;
