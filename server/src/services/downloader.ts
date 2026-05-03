import * as fs from 'fs';
import * as path from 'path';
import { runYtDlp } from './ytDlp';

export interface DownloadOptions {
  quality?: 'best' | 'worst';
  format?: 'mp4' | 'webm';
}

export interface DownloadResult {
  videoId: string;
  filePath: string;
  size: number;
  duration: number;
}

/**
 * Get proxy URL from environment
 */
function getProxy(): string {
  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy || '';
}

/**
 * Get storage directory for videos
 */
function getStorageDir(): string {
  const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  const storageDir = path.isAbsolute(storagePath) ? storagePath : path.resolve(process.cwd(), storagePath);
  const videosDir = path.join(storageDir, 'videos');

  // Create directory if it doesn't exist
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  return videosDir;
}

/**
 * Get video file path
 */
export function getVideoPath(videoId: string, format: string = 'mp4'): string {
  const storageDir = getStorageDir();
  return path.join(storageDir, `${videoId}.${format}`);
}

/**
 * Check if video is already downloaded
 */
export function isVideoDownloaded(videoId: string, format: string = 'mp4'): boolean {
  const filePath = getVideoPath(videoId, format);
  return fs.existsSync(filePath);
}

/**
 * Download video from YouTube using yt-dlp from venv
 */
export async function downloadVideo(
  videoId: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  const { quality = 'best', format = 'mp4' } = options;
  const filePath = getVideoPath(videoId, format);

  // Check if already downloaded
  if (isVideoDownloaded(videoId, format)) {
    const stats = fs.statSync(filePath);
    console.log(`Video ${videoId} already downloaded, using cached version`);

    return {
      videoId,
      filePath,
      size: stats.size,
      duration: 0 // Will be filled by caller if needed
    };
  }

  console.log(`Downloading video ${videoId} with quality ${quality}...`);

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const proxy = getProxy();
    const commonArgs: string[] = ['--no-warnings', '--no-call-home'];
    if (proxy) {
      commonArgs.push('--proxy', proxy);
    }

    // Get video info first
    const infoResult = await runYtDlp([...commonArgs, '--dump-json', videoUrl]);
    const info = JSON.parse(infoResult.stdout.trim()) as any;

    const duration = info.duration || 0;

    // Download video
    console.log(`  Starting download...`);
    await runYtDlp([
      ...commonArgs,
      '--format',
      quality === 'best' ? 'bestvideo+bestaudio/best' : 'worst',
      '--merge-output-format',
      format,
      '--output',
      filePath,
      videoUrl,
    ]);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Download failed: file not created');
    }

    const stats = fs.statSync(filePath);
    console.log(`Successfully downloaded video ${videoId} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return {
      videoId,
      filePath,
      size: stats.size,
      duration
    };
  } catch (error) {
    console.error(`Failed to download video ${videoId}:`, error);
    throw new Error(`Failed to download video ${videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete downloaded video
 */
export function deleteVideo(videoId: string, format: string = 'mp4'): boolean {
  const filePath = getVideoPath(videoId, format);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Deleted video ${videoId}`);
    return true;
  }

  return false;
}

/**
 * Get video file info
 */
export function getVideoInfo(videoId: string, format: string = 'mp4'): DownloadResult | null {
  const filePath = getVideoPath(videoId, format);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);

  return {
    videoId,
    filePath,
    size: stats.size,
    duration: 0 // Will be filled by caller if needed
  };
}

/**
 * Clean up old videos (older than specified days)
 */
export function cleanupOldVideos(maxAgeDays: number = 7): number {
  const storageDir = getStorageDir();
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const files = fs.readdirSync(storageDir);

    for (const file of files) {
      const filePath = path.join(storageDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && (now - stats.mtimeMs) > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Deleted old video: ${file}`);
      }
    }

    console.log(`Cleaned up ${deletedCount} old videos`);
  } catch (error) {
    console.error('Error cleaning up old videos:', error);
  }

  return deletedCount;
}

/**
 * Get total storage used by videos
 */
export function getTotalStorageSize(): number {
  const storageDir = getStorageDir();
  let totalSize = 0;

  try {
    const files = fs.readdirSync(storageDir);

    for (const file of files) {
      const filePath = path.join(storageDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error('Error calculating storage size:', error);
  }

  return totalSize;
}
