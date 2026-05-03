import { db } from '../db/init';
import { fetchChannelVideos, videoExists, saveVideo, getKOL } from './youtube';
import { segmentSubtitles } from './segmenter';
import { analyzeClip } from './llm';

export type JobStage = 'crawl' | 'process' | 'clip' | 'index';
export type JobStatus = 'pending' | 'running' | 'success' | 'failed';

export interface JobProgress {
  jobId: number;
  stage: JobStage;
  status: JobStatus;
  progress: number;
  videoTitle?: string;
  totalVideos?: number;
  processedVideos?: number;
  error?: string;
}

/**
 * Update job progress in database
 */
function updateJobProgress(
  jobId: number,
  stage: JobStage,
  status: JobStatus,
  progress: number,
  videoTitle?: string,
  error?: string
): void {
  db.prepare(`
    UPDATE jobs
    SET stage = ?, status = ?, progress = ?, error_message = ?
    WHERE id = ?
  `).run(stage, status, progress, error || null, jobId);

  console.log(`[Job ${jobId}] ${stage} - ${status} - ${progress}%${videoTitle ? ` - ${videoTitle}` : ''}`);
}

/**
 * Complete a job
 */
function completeJob(jobId: number, status: 'success' | 'failed', error?: string): void {
  db.prepare(`
    UPDATE jobs
    SET status = ?, progress = ?, error_message = ?, completed_at = ?
    WHERE id = ?
  `).run(status, status === 'success' ? 100 : 0, error || null, new Date().toISOString(), jobId);
}

/**
 * Process a single job through all 4 stages
 */
export async function processJob(jobId: number): Promise<void> {
  try {
    // Get job details
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const kol = getKOL(job.kol_id);
    if (!kol) {
      throw new Error(`KOL ${job.kol_id} not found`);
    }

    console.log(`[Job ${jobId}] Starting job for KOL: ${kol.name}`);

    // Stage 1: Crawl - Fetch channel videos
    await processCrawlStage(jobId, kol);

    // Stage 2: Process - Segment subtitles
    await processProcessStage(jobId, kol);

    // Stage 3: Clip - Analyze with LLM
    await processClipStage(jobId, kol);

    // Stage 4: Index - Save to database
    await processIndexStage(jobId, kol);

    // Mark job as complete
    completeJob(jobId, 'success');
    console.log(`[Job ${jobId}] Job completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Job ${jobId}] Job failed:`, errorMessage);
    completeJob(jobId, 'failed', errorMessage);
    throw error;
  }
}

/**
 * Stage 1: Crawl - Fetch channel videos
 */
async function processCrawlStage(jobId: number, kol: any): Promise<void> {
  updateJobProgress(jobId, 'crawl', 'running', 0);

  try {
    const maxVideos = kol.fetch_policy ? JSON.parse(kol.fetch_policy).max_videos || 20 : 20;
    const result = await fetchChannelVideos(kol.channel_url, maxVideos);

    updateJobProgress(jobId, 'crawl', 'running', 50, undefined, undefined);

    // Save videos to database
    let savedCount = 0;
    for (const video of result.videos) {
      if (!videoExists(video.videoId)) {
        saveVideo(video, kol.id);
        savedCount++;
      } else {
        // If video exists but maybe belongs to another "KOL" entry of the same channel
        // update the kol_id to the current one so it gets processed
        db.prepare('UPDATE videos SET kol_id = ? WHERE id = ?').run(kol.id, video.videoId);
        savedCount++; // Count it as "new" for this job's processing purposes
      }
    }

    updateJobProgress(jobId, 'crawl', 'success', 100, undefined, undefined);
    console.log(`[Job ${jobId}] Crawl stage completed: ${savedCount} new videos saved`);
  } catch (error) {
    updateJobProgress(jobId, 'crawl', 'failed', 0, undefined, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Stage 2: Process - Segment subtitles
 */
async function processProcessStage(jobId: number, kol: any): Promise<void> {
  updateJobProgress(jobId, 'process', 'running', 0);

  try {
    // Get videos for this KOL that haven't been processed yet
    const videos = db.prepare(`
      SELECT * FROM videos
      WHERE kol_id = ?
      AND id NOT IN (SELECT DISTINCT video_id FROM clips)
      ORDER BY published_at DESC
    `).all(kol.id) as any[];

    if (videos.length === 0) {
      updateJobProgress(jobId, 'process', 'success', 100);
      console.log(`[Job ${jobId}] Process stage completed: No new videos to process`);
      return;
    }

    // Process each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const progress = Math.round(((i + 1) / videos.length) * 100);

      try {
        const subtitles = JSON.parse(video.subtitles);
        const segments = segmentSubtitles(subtitles);

        // Store segments temporarily for the next stage
        // We'll use a temporary table or in-memory storage
        // For now, we'll just update the job progress
        updateJobProgress(jobId, 'process', 'running', progress, video.title);
      } catch (error) {
        console.error(`[Job ${jobId}] Failed to process video ${video.id}:`, error);
      }
    }

    updateJobProgress(jobId, 'process', 'success', 100);
    console.log(`[Job ${jobId}] Process stage completed: ${videos.length} videos processed`);
  } catch (error) {
    updateJobProgress(jobId, 'process', 'failed', 0, undefined, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Stage 3: Clip - Analyze with LLM
 */
async function processClipStage(jobId: number, kol: any): Promise<void> {
  updateJobProgress(jobId, 'clip', 'running', 0);

  try {
    // Get videos for this KOL that haven't been processed yet
    const videos = db.prepare(`
      SELECT * FROM videos
      WHERE kol_id = ?
      AND id NOT IN (SELECT DISTINCT video_id FROM clips)
      ORDER BY published_at DESC
    `).all(kol.id) as any[];

    if (videos.length === 0) {
      updateJobProgress(jobId, 'clip', 'success', 100);
      console.log(`[Job ${jobId}] Clip stage completed: No new videos to analyze`);
      return;
    }

    let totalSegments = 0;
    let processedSegments = 0;

    // First, count total segments
    for (const video of videos) {
      try {
        const subtitles = JSON.parse(video.subtitles);
        const segments = segmentSubtitles(subtitles);
        totalSegments += segments.length;
      } catch (error) {
        console.error(`[Job ${jobId}] Failed to segment video ${video.id}:`, error);
      }
    }

    // Process each video
    for (const video of videos) {
      try {
        const subtitles = JSON.parse(video.subtitles);
        const segments = segmentSubtitles(subtitles);

        // Analyze each segment
        for (const segment of segments) {
          try {
            const analysis = await analyzeClip(segment.text, video.title, kol.name);

            // Save clip to database
            db.prepare(`
              INSERT INTO clips (video_id, kol_name, start_sec, end_sec, title, summary, keywords, topic_category, thumbnail)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              video.id,
              kol.name,
              segment.startSec,
              segment.endSec,
              analysis.title,
              analysis.summary,
              JSON.stringify(analysis.keywords),
              analysis.topic_category,
              video.thumbnail
            );

            processedSegments++;
            const progress = Math.round((processedSegments / totalSegments) * 100);
            updateJobProgress(jobId, 'clip', 'running', progress, video.title);
          } catch (error) {
            console.error(`[Job ${jobId}] Failed to analyze segment:`, error);
          }
        }
      } catch (error) {
        console.error(`[Job ${jobId}] Failed to process video ${video.id}:`, error);
      }
    }

    updateJobProgress(jobId, 'clip', 'success', 100);
    console.log(`[Job ${jobId}] Clip stage completed: ${processedSegments} clips created`);

    if (processedSegments === 0 && totalSegments > 0) {
      throw new Error('Failed to generate any clips. Check LLM API configuration.');
    }
  } catch (error) {
    updateJobProgress(jobId, 'clip', 'failed', 0, undefined, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Stage 4: Index - Save to database (already done in clip stage)
 */
async function processIndexStage(jobId: number, kol: any): Promise<void> {
  updateJobProgress(jobId, 'index', 'running', 0);

  try {
    // In this implementation, indexing is done during the clip stage
    // This stage is mainly for generating embeddings or other indexing tasks

    // For now, just mark as complete
    updateJobProgress(jobId, 'index', 'running', 50);

    // TODO: Generate embeddings for semantic search
    // This would involve calling OpenAI's embeddings API

    updateJobProgress(jobId, 'index', 'success', 100);
    console.log(`[Job ${jobId}] Index stage completed`);
  } catch (error) {
    updateJobProgress(jobId, 'index', 'failed', 0, undefined, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Get running jobs
 */
export function getRunningJobs(): any[] {
  return db.prepare('SELECT * FROM jobs WHERE status = ?').all('running') as any[];
}

/**
 * Get pending jobs
 */
export function getPendingJobs(): any[] {
  return db.prepare('SELECT * FROM jobs WHERE status = ?').all('pending') as any[];
}
