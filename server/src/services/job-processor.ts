import { db } from '../db/init';
import { fetchChannelVideos, videoExists, saveVideo, getKOL } from './youtube';
import { sliceVideoByLLM } from './llm';
import { generateClipThumbnailAtTimestamp } from './clip-thumbnail';
import { notifyJobsChanged } from './job-broadcast';
import { renderVerticalVideo } from './vertical-renderer';
import type { SubtitleSegment } from '../types';

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
  notifyJobsChanged();
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
  notifyJobsChanged(true);
}

/**
 * Process a single job through all 4 stages
 */
export async function processJob(jobId: number): Promise<void> {
  try {
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

    // Stage 2: Process - (保留阶段用于兼容性，实际切片在clip阶段由LLM完成)
    await processProcessStage(jobId, kol);

    // Stage 3: Clip - 让LLM切分视频，按时间段提取字幕保存
    await processClipStage(jobId, kol);

    // Stage 4: Index
    await processIndexStage(jobId, kol);

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

    let savedCount = 0;
    for (const video of result.videos) {
      if (!videoExists(video.videoId)) {
        saveVideo(video, kol.id);
        savedCount++;
      } else {
        db.prepare('UPDATE videos SET kol_id = ? WHERE id = ?').run(kol.id, video.videoId);
        savedCount++;
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
 * Stage 2: Process - 标记已处理（实际切片逻辑移到clip阶段）
 */
async function processProcessStage(jobId: number, kol: any): Promise<void> {
  updateJobProgress(jobId, 'process', 'running', 0);

  const videos = db.prepare(`
    SELECT * FROM videos
    WHERE kol_id = ?
    AND id NOT IN (SELECT DISTINCT video_id FROM clips)
    ORDER BY published_at DESC
  `).all(kol.id) as any[];

  if (videos.length === 0) {
    updateJobProgress(jobId, 'process', 'success', 100);
    return;
  }

  // 验证字幕可解析
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    if (!video.subtitles) {
      throw new Error(`Video ${video.id} has no subtitles`);
    }
    JSON.parse(video.subtitles);
    updateJobProgress(jobId, 'process', 'running', Math.round(((i + 1) / videos.length) * 100), video.title);
  }

  updateJobProgress(jobId, 'process', 'success', 100);
  console.log(`[Job ${jobId}] Process stage completed: ${videos.length} videos ready`);
}

/**
 * Stage 3: Clip - 【核心】让LLM切分视频，按时间段保存clip
 *
 * 流程：
 * 1. 取完整字幕给LLM
 * 2. LLM返回 [{title, start_sec, end_sec}, ...]
 * 3. 对每个返回的片段：
 *    - 按时间段从原始字幕中过滤出该片段的字幕
 *    - 生成缩略图
 *    - 保存到clips表（只存 title, start_sec, end_sec, subtitles）
 *    - 异步渲染竖屏视频
 */
async function processClipStage(jobId: number, kol: any): Promise<void> {
  updateJobProgress(jobId, 'clip', 'running', 0);

  try {
    const videos = db.prepare(`
      SELECT * FROM videos
      WHERE kol_id = ?
      AND id NOT IN (SELECT DISTINCT video_id FROM clips)
      ORDER BY published_at DESC
    `).all(kol.id) as any[];

    if (videos.length === 0) {
      updateJobProgress(jobId, 'clip', 'success', 100);
      return;
    }

    let totalClips = 0;
    let processedClips = 0;

    // 先估算总片段数（用于进度条）
    for (const video of videos) {
      const subtitles = JSON.parse(video.subtitles) as SubtitleSegment[];
      // 预估：每60秒一个片段
      const duration = subtitles.length > 0
        ? subtitles[subtitles.length - 1].end - subtitles[0].start
        : 0;
      totalClips += Math.max(1, Math.floor(duration / 60));
    }

    for (const video of videos) {
      const subtitles = JSON.parse(video.subtitles) as SubtitleSegment[];
      if (!subtitles || subtitles.length === 0) {
        throw new Error(`Video ${video.id} has no subtitles`);
      }

        console.log(`[Job ${jobId}] Slicing video: ${video.title} (${subtitles.length} subtitle segments)`);

        // 【核心】让LLM切分视频
        const slices = await sliceVideoByLLM(subtitles, video.title, kol.name);
        console.log(`[Job ${jobId}] LLM returned ${slices.length} slices for ${video.title}`);

        for (const slice of slices) {
          // 按时间段提取该片段的字幕
          const clipSubtitles = subtitles.filter(
            s => s.start >= slice.start_sec && s.end <= slice.end_sec
          );

          // 生成缩略图（失败不影响主流程，使用视频缩略图兜底）
          const frameThumb = await generateClipThumbnailAtTimestamp(
            video.id,
            slice.start_sec,
            slice.end_sec
          );
          const thumbnailUrl = frameThumb || video.thumbnail || null;

          // 保存clip到数据库
          const result = db.prepare(`
            INSERT INTO clips (video_id, kol_name, start_sec, end_sec, title, thumbnail, subtitles)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            video.id,
            kol.name,
            slice.start_sec,
            slice.end_sec,
            slice.title,
            thumbnailUrl,
            JSON.stringify(clipSubtitles)
          );

          const clipId = result.lastInsertRowid as number;

          // 异步渲染竖屏视频
          renderVerticalVideo({
            id: clipId,
            video_id: video.id,
            kol_name: kol.name,
            start_sec: slice.start_sec,
            end_sec: slice.end_sec,
            title: slice.title,
            thumbnail: thumbnailUrl,
            subtitles: clipSubtitles,
          }).then((outputPath) => {
            console.log(`[Job ${jobId}] Vertical video pre-rendered for clip ${clipId}: ${outputPath}`);
          }).catch(err => {
            console.error(`[Job ${jobId}] Failed to render vertical video for clip ${clipId}:`, err.message);
          });

          processedClips++;
          const progress = Math.min(100, Math.round((processedClips / totalClips) * 100));
          updateJobProgress(jobId, 'clip', 'running', progress, video.title);
        }
    }

    updateJobProgress(jobId, 'clip', 'success', 100);
    console.log(`[Job ${jobId}] Clip stage completed: ${processedClips} clips created`);

    if (processedClips === 0 && videos.length > 0) {
      throw new Error('Failed to generate any clips. Check LLM API configuration.');
    }
  } catch (error) {
    updateJobProgress(jobId, 'clip', 'failed', 0, undefined, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Stage 4: Index
 */
async function processIndexStage(jobId: number, kol: any): Promise<void> {
  updateJobProgress(jobId, 'index', 'running', 0);
  updateJobProgress(jobId, 'index', 'success', 100);
  console.log(`[Job ${jobId}] Index stage completed`);
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
