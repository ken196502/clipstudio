import youtubedl from 'youtube-dl-exec';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/init';

export interface VideoMetadata {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
  publishedAt: string;
  subtitles: SubtitleSegment[];
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface ChannelVideos {
  videos: VideoMetadata[];
}

/**
 * Get proxy URL from environment
 */
function getProxy(): string {
  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy || '';
}

/**
 * Extract channel handle from URL
 * Supports formats:
 * - youtube.com/@channel
 * - youtube.com/channel/UC...
 * - youtube.com/c/channel
 */
export function extractChannelHandle(channelUrl: string): string {
  const url = channelUrl.trim();

  // Handle @channel format
  if (url.includes('@')) {
    const match = url.match(/@([^\/\?]+)/);
    if (match) return match[1];
  }

  // Handle channel/UC... format
  if (url.includes('/channel/')) {
    const match = url.match(/\/channel\/([^\/\?]+)/);
    if (match) return match[1];
  }

  // Handle /c/channel format
  if (url.includes('/c/')) {
    const match = url.match(/\/c\/([^\/\?]+)/);
    if (match) return match[1];
  }

  // If no format matches, return the URL as-is
  return url;
}

/**
 * Parse VTT subtitle file
 */
function parseVTT(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const lines = content.split('\n');
  let currentSegment: SubtitleSegment | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header and empty lines
    if (line === 'WEBVTT' || line === '' || line.startsWith('Kind:') || line.startsWith('Language:')) {
      continue;
    }

    // Parse timestamp line: 00:00:01.360 --> 00:00:03.040
    const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timestampMatch) {
      const start = parseVTTTime(timestampMatch[1]);
      const end = parseVTTTime(timestampMatch[2]);

      if (currentSegment) {
        segments.push(currentSegment);
      }

      currentSegment = { start, end, text: '' };
    } else if (currentSegment && line && !line.startsWith('[')) {
      // This is subtitle text
      if (currentSegment.text) {
        currentSegment.text += ' ';
      }
      currentSegment.text += line;
    }
  }

  // Add the last segment
  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Parse VTT time format to seconds
 */
function parseVTTTime(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get video info including subtitles
 */
async function getVideoWithSubtitles(videoId: string): Promise<VideoMetadata | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const proxy = getProxy();

    console.log(`Fetching video info for ${videoId}...`);

    // Get video info
    const info = await youtubedl(videoUrl, {
      dumpJson: true,
      noWarnings: true,
      noCallHome: true,
      proxy: proxy
    });

    console.log(`  Title: ${info.title}`);
    console.log(`  Duration: ${info.duration} seconds`);

    // Download subtitles
    const subtitlePath = path.join(process.cwd(), `temp-${videoId}.vtt`);
    let subtitles: SubtitleSegment[] = [];

    try {
      await youtubedl(videoUrl, {
        writeSub: true,
        subLang: 'en',
        subFormat: 'vtt',
        output: subtitlePath,
        noWarnings: true,
        noCallHome: true,
        proxy: proxy
      });

      // Find the actual subtitle file (youtube-dl adds language suffix)
      const subtitleFiles = fs.readdirSync(process.cwd())
        .filter(f => f.startsWith(`temp-${videoId}.vtt`) && f.endsWith('.vtt'));

      if (subtitleFiles.length > 0) {
        const actualSubtitlePath = path.join(process.cwd(), subtitleFiles[0]);
        const content = fs.readFileSync(actualSubtitlePath, 'utf-8');
        subtitles = parseVTT(content);
        console.log(`  Extracted ${subtitles.length} subtitle segments`);

        // Clean up
        fs.unlinkSync(actualSubtitlePath);
      }
    } catch (subtitleError) {
      console.warn(`  Failed to extract subtitles: ${subtitleError}`);
    }

    // Skip videos without subtitles
    if (subtitles.length === 0) {
      console.log(`  Skipping ${videoId}: No subtitles available`);
      return null;
    }

    return {
      videoId,
      title: info.title,
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      publishedAt: info.upload_date || new Date().toISOString(),
      subtitles
    };
  } catch (error) {
    console.error(`Failed to get video info for ${videoId}:`, error);
    return null;
  }
}

/**
 * Fetch channel videos
 * Note: youtube-dl-exec doesn't support channel browsing directly
 * This is a placeholder - you would need YouTube Data API v3 for this
 */
export async function fetchChannelVideos(
  channelUrl: string,
  maxVideos: number = 20
): Promise<ChannelVideos> {
  try {
    const channelHandle = extractChannelHandle(channelUrl);
    console.log(`Fetching channel: ${channelHandle}`);

    // youtube-dl-exec doesn't support channel browsing
    // This is a limitation - you would need YouTube Data API v3 for this
    console.warn('youtube-dl-exec does not support channel browsing. Use YouTube Data API v3 instead.');

    return { videos: [] };
  } catch (error) {
    console.error('Failed to fetch channel videos:', error);
    throw new Error(`Failed to fetch channel videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get video info by video ID
 */
export async function getVideoInfo(videoId: string): Promise<VideoMetadata | null> {
  try {
    return await getVideoWithSubtitles(videoId);
  } catch (error) {
    console.error(`Failed to get video info for ${videoId}:`, error);
    return null;
  }
}

/**
 * Check if video already exists in database
 */
export function videoExists(videoId: string): boolean {
  const result = db.prepare('SELECT id FROM videos WHERE id = ?').get(videoId);
  return !!result;
}

/**
 * Save video to database
 */
export function saveVideo(video: VideoMetadata, kolId: number): void {
  db.prepare(`
    INSERT INTO videos (id, kol_id, title, duration, thumbnail, published_at, subtitles)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    video.videoId,
    kolId,
    video.title,
    video.duration,
    video.thumbnail,
    video.publishedAt,
    JSON.stringify(video.subtitles)
  );
}

/**
 * Get KOL by ID
 */
export function getKOL(kolId: number): any {
  return db.prepare('SELECT * FROM kols WHERE id = ?').get(kolId);
}
