import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface ExtractClipOptions {
  videoPath: string;
  startSec: number;
  endSec: number;
  outputPath: string;
  codec?: 'copy' | 'reencode';
  quality?: number; // 1-31 for CRF (lower is better)
}

export interface CombineClipsOptions {
  clipPaths: string[];
  outputPath: string;
  codec?: 'copy' | 'reencode';
  quality?: number;
}

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}

/**
 * Get temp directory for processing
 */
function getTempDir(): string {
  const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  const storageDir = path.isAbsolute(storagePath) ? storagePath : path.resolve(process.cwd(), storagePath);
  const tempDir = path.join(storageDir, 'temp');

  // Create directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  return tempDir;
}

/**
 * Get output directory for combined videos
 */
function getOutputDir(): string {
  const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  const storageDir = path.isAbsolute(storagePath) ? storagePath : path.resolve(process.cwd(), storagePath);
  const outputDir = path.join(storageDir, 'output');

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

/**
 * Check if FFmpeg is installed
 */
export async function checkFFmpeg(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (error) {
    console.error('FFmpeg is not installed or not in PATH');
    return false;
  }
}

/**
 * Get video information using ffprobe
 */
export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate,codec_name -of json "${videoPath}"`
    );

    const data = JSON.parse(stdout);

    // Get video stream info
    const videoStream = data.streams.find((s: any) => s.codec_type === 'video');

    // Parse frame rate (e.g., "30/1" -> 30)
    let fps = 30;
    if (videoStream?.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      fps = den > 0 ? num / den : 30;
    }

    return {
      duration: parseFloat(data.format.duration) || 0,
      width: videoStream?.width || 1920,
      height: videoStream?.height || 1080,
      fps,
      codec: videoStream?.codec_name || 'h264'
    };
  } catch (error) {
    console.error('Failed to get video info:', error);
    throw new Error(`Failed to get video info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract a clip from a video
 */
export async function extractClip(options: ExtractClipOptions): Promise<string> {
  const { videoPath, startSec, endSec, outputPath, codec = 'copy', quality = 23 } = options;

  // Validate input
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  if (startSec < 0) {
    throw new Error(`Start time must be >= 0: ${startSec}`);
  }

  if (endSec <= startSec) {
    throw new Error(`End time must be > start time: ${startSec} -> ${endSec}`);
  }

  const duration = endSec - startSec;

  console.log(`Extracting clip: ${videoPath} (${startSec}s - ${endSec}s, ${duration}s total)`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    let command: string;

    if (codec === 'copy') {
      // Fast copy (no re-encoding)
      command = `ffmpeg -i "${videoPath}" -ss ${startSec} -to ${endSec} -c copy -y "${outputPath}"`;
    } else {
      // Re-encode with specified quality
      command = `ffmpeg -i "${videoPath}" -ss ${startSec} -to ${endSec} -c:v libx264 -crf ${quality} -c:a aac -y "${outputPath}"`;
    }

    const { stderr } = await execAsync(command);

    // Check if output file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg failed to create output file');
    }

    console.log(`Successfully extracted clip to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Failed to extract clip:', error);
    throw new Error(`Failed to extract clip: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Combine multiple clips into a single video
 */
export async function combineClips(options: CombineClipsOptions): Promise<string> {
  const { clipPaths, outputPath, codec = 'copy', quality = 23 } = options;

  // Validate input
  if (!clipPaths || clipPaths.length === 0) {
    throw new Error('No clips provided');
  }

  for (const clipPath of clipPaths) {
    if (!fs.existsSync(clipPath)) {
      throw new Error(`Clip file not found: ${clipPath}`);
    }
  }

  console.log(`Combining ${clipPaths.length} clips into: ${outputPath}`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Create concat list file
    const tempDir = getTempDir();
    const concatListPath = path.join(tempDir, `concat_${Date.now()}.txt`);

    const concatList = clipPaths.map(clipPath => `file '${clipPath}'`).join('\n');
    fs.writeFileSync(concatListPath, concatList);

    let command: string;

    if (codec === 'copy') {
      // Fast concat (no re-encoding)
      command = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy -y "${outputPath}"`;
    } else {
      // Re-encode with specified quality
      command = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -crf ${quality} -c:a aac -y "${outputPath}"`;
    }

    const { stderr } = await execAsync(command);

    // Clean up concat list file
    fs.unlinkSync(concatListPath);

    // Check if output file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg failed to create output file');
    }

    console.log(`Successfully combined clips to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Failed to combine clips:', error);
    throw new Error(`Failed to combine clips: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a thumbnail from a video
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp: number = 0
): Promise<string> {
  console.log(`Generating thumbnail at ${timestamp}s from: ${videoPath}`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const command = `ffmpeg -i "${videoPath}" -ss ${timestamp} -vframes 1 -q:v 2 -y "${outputPath}"`;
    await execAsync(command);

    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg failed to create thumbnail');
    }

    console.log(`Successfully generated thumbnail: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    throw new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get video duration
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  const info = await getVideoInfo(videoPath);
  return info.duration;
}

/**
 * Clean up temp files
 */
export function cleanupTempFiles(): number {
  const tempDir = getTempDir();
  let deletedCount = 0;

  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    }

    console.log(`Cleaned up ${deletedCount} temp files`);
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }

  return deletedCount;
}
