import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { runYtDlp } from './ytDlp';
import { checkFFmpeg } from './ffmpeg';

const execFileAsync = promisify(execFile);

function proxyArgs(): string[] {
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    '';
  const p = proxy.trim();
  return p ? ['--proxy', p] : [];
}

export function getClipThumbnailsDir(): string {
  const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  const storageDir = path.isAbsolute(storagePath) ? storagePath : path.resolve(process.cwd(), storagePath);
  const dir = path.join(storageDir, 'clip-thumbnails');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Grab a single frame from the YouTube stream near the clip midpoint (via yt-dlp URL + ffmpeg).
 * Returns a path served by Express static middleware, e.g. /api/clip-thumbnails/{videoId}_{start}_{end}.jpg
 */
export async function generateClipThumbnailAtTimestamp(
  videoId: string,
  startSec: number,
  endSec: number
): Promise<string | null> {
  if (process.env.CLIP_THUMBNAILS === '0') {
    return null;
  }
  if (!(await checkFFmpeg())) {
    console.warn('[clip-thumbnail] ffmpeg not available; skipping frame capture');
    return null;
  }

  const mid = Math.max(0, Math.floor((startSec + endSec) / 2));
  const safeName = `${videoId}_${Math.floor(startSec)}_${Math.floor(endSec)}.jpg`;
  const outPath = path.join(getClipThumbnailsDir(), safeName);

  if (fs.existsSync(outPath)) {
    return `/api/clip-thumbnails/${safeName}`;
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let streamUrl: string;
  try {
    const { stdout } = await runYtDlp([
      '--no-warnings',
      '--no-playlist',
      ...proxyArgs(),
      '-f',
      'bv*[height<=480]/best[height<=480]',
      '-g',
      watchUrl,
    ]);
    const line = stdout
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^https?:\/\//i.test(l));
    if (!line) {
      return null;
    }
    streamUrl = line;
  } catch (e) {
    console.warn('[clip-thumbnail] yt-dlp failed for', videoId, e);
    return null;
  }

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-ss',
        String(mid),
        '-i',
        streamUrl,
        '-frames:v',
        '1',
        '-q:v',
        '4',
        outPath,
      ],
      { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 }
    );
  } catch (e) {
    console.warn('[clip-thumbnail] ffmpeg failed for', videoId, 'at', mid, e);
    return null;
  }

  if (!fs.existsSync(outPath)) {
    return null;
  }
  return `/api/clip-thumbnails/${safeName}`;
}
