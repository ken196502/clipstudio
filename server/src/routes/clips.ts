import express, { Request, Response } from 'express';
import { db } from '../db/init';
import type { Clip, SearchRequest, SearchResponse } from '../types';
import { AppError, asyncHandler } from '../middleware/error-handler';

const router = express.Router();

// GET /api/clips - Get all clips (with optional filters)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { kolName, category, sort = 'newest', limit = 50, offset = 0 } = req.query;

  let query = 'SELECT * FROM clips WHERE 1=1';
  const params: any[] = [];

  if (kolName) {
    query += ' AND kol_name = ?';
    params.push(kolName);
  }

  if (category) {
    query += ' AND topic_category = ?';
    params.push(category);
  }

  // Sorting
  if (sort === 'newest') {
    query += ' ORDER BY created_at DESC';
  } else if (sort === 'oldest') {
    query += ' ORDER BY created_at ASC';
  }

  // Pagination
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string), parseInt(offset as string));

  const rows = db.prepare(query).all(...params) as any[];

  const clips: Clip[] = rows.map(row => ({
    id: row.id,
    video_id: row.video_id,
    kol_name: row.kol_name,
    start_sec: row.start_sec,
    end_sec: row.end_sec,
    title: row.title,
    summary: row.summary,
    keywords: row.keywords ? JSON.parse(row.keywords) : [],
    topic_category: row.topic_category,
    thumbnail: row.thumbnail,
    created_at: row.created_at
  }));

  // Get total count
  const countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '').replace(/ LIMIT.*$/, '');
  const countParams = params.slice(0, -2);
  const total = (db.prepare(countQuery).get(...countParams) as any)['COUNT(*)'];

  res.json({ clips, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
}));

// GET /api/clips/:id - Get clip by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  const row = db.prepare('SELECT * FROM clips WHERE id = ?').get(id) as any;

  if (!row) {
    throw new AppError(404, 'Clip not found');
  }

  const clip: Clip = {
    id: row.id,
    video_id: row.video_id,
    kol_name: row.kol_name,
    start_sec: row.start_sec,
    end_sec: row.end_sec,
    title: row.title,
    summary: row.summary,
    keywords: row.keywords ? JSON.parse(row.keywords) : [],
    topic_category: row.topic_category,
    thumbnail: row.thumbnail,
    created_at: row.created_at
  };

  res.json({ clip });
}));

// POST /api/clips/search - Search clips (keyword matching)
router.post('/search', asyncHandler(async (req: Request, res: Response) => {
  const { query, limit = 10 } = req.body as SearchRequest;

  if (!query || !query.trim()) {
    throw new AppError(400, 'Query is required');
  }

  const searchTerms = query.trim().toLowerCase().split(/\s+/);

  // Simple keyword matching with relevance scoring
  const rows = db.prepare('SELECT * FROM clips').all() as any[];

  const results = rows.map(row => {
    const title = row.title.toLowerCase();
    const summary = row.summary?.toLowerCase() || '';
    const keywords = row.keywords ? JSON.parse(row.keywords).map((k: string) => k.toLowerCase()) : [];

    let relevance = 0;

    // Check each search term
    searchTerms.forEach(term => {
      if (title.includes(term)) relevance += 30;
      if (summary.includes(term)) relevance += 20;
      if (keywords.some((k: string) => k.includes(term))) relevance += 10;
    });

    return {
      clip: {
        id: row.id,
        video_id: row.video_id,
        kol_name: row.kol_name,
        start_sec: row.start_sec,
        end_sec: row.end_sec,
        title: row.title,
        summary: row.summary,
        keywords: row.keywords ? JSON.parse(row.keywords) : [],
        topic_category: row.topic_category,
        thumbnail: row.thumbnail,
        created_at: row.created_at
      },
      relevance
    };
  })
  .filter(result => result.relevance > 0)
  .sort((a, b) => b.relevance - a.relevance)
  .slice(0, limit);

  const response: SearchResponse = { results };

  res.json(response);
}));

export default router;
