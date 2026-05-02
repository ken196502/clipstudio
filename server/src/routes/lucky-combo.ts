import express from 'express';
import { db } from '../db/init';
import type { LuckyComboRequest } from '../types';
import { AppError, asyncHandler } from '../middleware/error-handler';

const router = express.Router();

// POST /api/lucky-combo - Smart clip selection
router.post('/', asyncHandler(async (req, res) => {
  const { prompt } = req.body as LuckyComboRequest;

  if (!prompt || !prompt.trim()) {
    throw new AppError(400, 'prompt is required');
  }

  // Get all clips
  const rows = db.prepare('SELECT * FROM clips').all() as any[];

  // Simple keyword matching (in production, use LLM for better selection)
  const searchTerms = prompt.trim().toLowerCase().split(/\s+/);

  const scoredClips = rows.map(row => {
    const title = row.title.toLowerCase();
    const summary = row.summary?.toLowerCase() || '';
    const keywords = row.keywords ? JSON.parse(row.keywords).map((k: string) => k.toLowerCase()) : [];

    let score = 0;

    searchTerms.forEach(term => {
      if (title.includes(term)) score += 30;
      if (summary.includes(term)) score += 20;
      if (keywords.some((k: string) => k.includes(term))) score += 10;
    });

    return {
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
      created_at: row.created_at,
      score
    };
  })
  .filter(clip => clip.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5); // Select top 5 clips

  if (scoredClips.length === 0) {
    return res.json({
      selectedClips: [],
      reasoning: 'No clips found matching the prompt'
    });
  }

  res.json({
    selectedClips: scoredClips,
    reasoning: `Selected ${scoredClips.length} clips based on keyword matching with the prompt: "${prompt}"`
  });
}));

export default router;
