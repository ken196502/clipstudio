import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { CombineRequest } from '../types';
import { db } from '../db/init';
import { downloadVideo, isVideoDownloaded, getVideoPath } from '../services/downloader';
import { extractClip, combineClips, getVideoInfo } from '../services/ffmpeg';
import { AppError, asyncHandler } from '../middleware/error-handler';
import * as path from 'path';
import * as fs from 'fs';

const router = express.Router();

// Store combine tasks in memory (in production, use database)
const combineTasks = new Map<string, {
  status: string;
  progress: number;
  downloadUrl?: string;
  error?: string;
  currentClip?: number;
  totalClips?: number;
}>();

/**
 * POST /api/combine - Submit combine task
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { clipIds, outputFormat = 'mp4', resolution = '1080p' } = req.body as CombineRequest;

  if (!clipIds || !Array.isArray(clipIds) || clipIds.length === 0) {
    throw new AppError(400, 'clipIds is required and must be a non-empty array');
  }

  const taskId = uuidv4();

  // Initialize task
  combineTasks.set(taskId, {
    status: 'processing',
    progress: 0,
    currentClip: 0,
    totalClips: clipIds.length
  });

  // Start processing in background
  processCombineTask(taskId, clipIds, outputFormat).catch(error => {
    console.error('Error processing combine task:', error);
    const task = combineTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
    }
  });

  res.json({
    taskId,
    status: 'processing',
    estimatedTime: clipIds.length * 30 // 30 seconds per clip
  });
}));

/**
 * GET /api/combine/:taskId - Get combine task status
 */
router.get('/:taskId', asyncHandler(async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;

  const task = combineTasks.get(taskId);

  if (!task) {
    throw new AppError(404, 'Task not found');
  }

  res.json({
    taskId,
    status: task.status,
    progress: task.progress,
    downloadUrl: task.downloadUrl,
    error: task.error,
    currentClip: task.currentClip,
    totalClips: task.totalClips
  });
}));

/**
 * Process combine task
 */
async function processCombineTask(
  taskId: string,
  clipIds: number[],
  outputFormat: string
): Promise<void> {
  const task = combineTasks.get(taskId);
  if (!task) return;

  try {
    // Get clips from database
    const clips = clipIds.map(id => {
      const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(id);
      if (!clip) {
        throw new Error(`Clip ${id} not found`);
      }
      return clip as any;
    });

    task.totalClips = clips.length;

    // Download videos and extract clips
    const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
    const storageDir = path.isAbsolute(storagePath) ? storagePath : path.resolve(process.cwd(), storagePath);
    const tempDir = path.join(storageDir, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const extractedClips: string[] = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      task.currentClip = i + 1;
      task.progress = Math.round((i / clips.length) * 80); // 80% for extraction

      console.log(`Processing clip ${i + 1}/${clips.length}: ${clip.title}`);

      // Check if video is downloaded
      if (!isVideoDownloaded(clip.video_id)) {
        console.log(`Downloading video ${clip.video_id}...`);
        await downloadVideo(clip.video_id, { quality: 'best' });
      }

      // Get video path
      const videoPath = getVideoPath(clip.video_id);

      // Extract clip
      const clipPath = path.join(tempDir, `clip_${clip.id}.mp4`);
      await extractClip({
        videoPath,
        startSec: clip.start_sec,
        endSec: clip.end_sec,
        outputPath: clipPath,
        codec: 'reencode' // Use reencode for safety
      });

      extractedClips.push(clipPath);
    }

    // Combine clips
    task.progress = 85;
    console.log('Combining clips...');

    const outputDir = path.join(storageDir, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, `${taskId}.${outputFormat}`);

    await combineClips({
      clipPaths: extractedClips,
      outputPath,
      codec: 'reencode' // Use reencode for safety
    });

    // Clean up temp files
    console.log('Cleaning up temp files...');
    for (const clipPath of extractedClips) {
      try {
        if (require('fs').existsSync(clipPath)) {
          require('fs').unlinkSync(clipPath);
        }
      } catch (error) {
        console.error(`Failed to delete temp file ${clipPath}:`, error);
      }
    }

    // Update task status
    task.progress = 100;
    task.status = 'completed';
    task.downloadUrl = `/api/combine/download/${taskId}.${outputFormat}`;

    console.log(`Combine task ${taskId} completed successfully`);
  } catch (error) {
    console.error(`Error processing combine task ${taskId}:`, error);
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : 'Unknown error';
  }
}

/**
 * GET /api/combine/download/:filename - Download combined video
 */
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(process.cwd(), 'storage', 'output', filename);

    if (!require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router;
