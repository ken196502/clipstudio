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
  /** Portrait 9:16 mode */
  portrait?: boolean;
  /** Text overlay for each clip: array of strings matching clipPaths length */
  textOverlays?: string[];
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
 * Build FFmpeg filter_complex for portrait 9:16 output with blurred background
 * and top text overlay.
 *
 * For each input video:
 *   1. Scale to fit within 1080x1920 while maintaining aspect ratio (scale=1080:-2)
 *   2. Create blurred background: scale to cover 1080x1920, apply boxblur
 *   3. Overlay centered video on top of blurred background
 *   4. Add text overlay at top (if provided)
 */
function buildPortraitFilterComplex(
  clipCount: number,
  textOverlays?: string[]
): string {
  const filters: string[] = [];

  for (let i = 0; i < clipCount; i++) {
    const vi = `[${i}:v]`;
    // Step 1: Scale video to fit width 1080, keep aspect ratio
    filters.push(`${vi}scale=1080:-2:force_original_aspect_ratio=decrease[v${i}_scaled]`);
    // Step 2: Create blurred background - scale to cover, then blur
    filters.push(`[v${i}_scaled]split[bg${i}_orig][fg${i}];[bg${i}_orig]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=luma_radius=20:luma_power=3[bg${i}]`);
    // Step 3: Overlay centered video on blurred background
    filters.push(`[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2:format=auto[bgfg${i}]`);
    // Step 4: Add text overlay at top if provided
    const text = textOverlays?.[i]?.trim();
    if (text) {
      // Escape special characters for drawtext
      const escaped = text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/:/g, '\\:')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/%/g, '\\%');
      filters.push(`[bgfg${i}]drawtext=text='${escaped}':fontcolor=white:fontsize=48:fontfile=/System/Library/Fonts/Helvetica.ttc:x=(w-text_w)/2:y=80:box=1:boxcolor=black@0.6:boxborderw=16:line_spacing=8[vt${i}]`);
    } else {
      filters.push(`[bgfg${i}]copy[vt${i}]`);
    }
  }

  // Concatenate all processed video segments
  const concatInputs = Array.from({ length: clipCount }, (_, i) => `[vt${i}]`).join('');
  filters.push(`${concatInputs}concat=n=${clipCount}:v=1:a=0[vout]`);

  return filters.join(';');
}

/**
 * Combine multiple clips into a single video
 */
export async function combineClips(options: CombineClipsOptions): Promise<string> {
  const { clipPaths, outputPath, codec = 'copy', quality = 23, portrait = false, textOverlays } = options;

  // Validate input
  if (!clipPaths || clipPaths.length === 0) {
    throw new Error('No clips provided');
  }

  for (const clipPath of clipPaths) {
    if (!fs.existsSync(clipPath)) {
      throw new Error(`Clip file not found: ${clipPath}`);
    }
  }

  console.log(`Combining ${clipPaths.length} clips into: ${outputPath} (portrait=${portrait})`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Portrait mode: process each clip individually with filter_complex, then concat
    if (portrait) {
      const tempDir = getTempDir();
      const processedPaths: string[] = [];

      for (let i = 0; i < clipPaths.length; i++) {
        const clipPath = clipPaths[i];
        const processedPath = path.join(tempDir, `portrait_clip_${i}_${Date.now()}.mp4`);
        const text = textOverlays?.[i]?.trim();

        let filterComplex: string;
        if (text) {
          const escaped = text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/:/g, '\\:')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/%/g, '\\%');
          filterComplex = `[0:v]scale=1080:-2:force_original_aspect_ratio=decrease[scaled];[scaled]split[orig][fg];[orig]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=luma_radius=20:luma_power=3[bg];[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto[bgfg];[bgfg]drawtext=text='${escaped}':fontcolor=white:fontsize=48:fontfile=/System/Library/Fonts/Helvetica.ttc:x=(w-text_w)/2:y=80:box=1:boxcolor=black@0.6:boxborderw=16:line_spacing=8[outv]`;
        } else {
          filterComplex = `[0:v]scale=1080:-2:force_original_aspect_ratio=decrease[scaled];[scaled]split[orig][fg];[orig]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=luma_radius=20:luma_power=3[bg];[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto[outv]`;
        }

        const cmd = `ffmpeg -y -i "${clipPath}" -filter_complex "${filterComplex}" -map "[outv]" -map "0:a?" -c:v libx264 -crf ${quality} -c:a aac -shortest -r 30 "${processedPath}"`;
        await execAsync(cmd);

        if (!fs.existsSync(processedPath)) {
          throw new Error(`Failed to process portrait clip ${i}`);
        }
        processedPaths.push(processedPath);
      }

      // Concatenate processed portrait clips
      const concatListPath = path.join(tempDir, `concat_portrait_${Date.now()}.txt`);
      const concatList = processedPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(concatListPath, concatList);

      const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`;
      await execAsync(concatCmd);

      // Clean up temp files
      fs.unlinkSync(concatListPath);
      for (const p of processedPaths) {
        try { fs.unlinkSync(p); } catch {}
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error('FFmpeg failed to create output file');
      }

      console.log(`Successfully combined portrait clips to: ${outputPath}`);
      return outputPath;
    }

    // Landscape mode: original concat behavior
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
