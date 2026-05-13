import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import puppeteer, { type Browser } from 'puppeteer-core';
import { db } from '../db/init';
import type { SubtitleSegment } from '../types';

const OUTPUT_DIR = path.resolve(process.cwd(), 'storage', 'vertical-videos');
const TEMP_DIR = path.resolve(process.cwd(), 'storage', 'temp');

for (const dir of [OUTPUT_DIR, TEMP_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

interface ClipData {
  id: number;
  video_id: string;
  kol_name: string;
  start_sec: number;
  end_sec: number;
  title: string;
  thumbnail: string | null;
  subtitles?: SubtitleSegment[];
}

// ─── Layout constants (1080×1920 竖屏) ─────────────────────────────
const CANVAS_W = 1080;
const CANVAS_H = 1920;

// 视频素材是 16:9，宽度 1080 时高度 = 607.5
// 视频居中：顶部 y = (1920 - 607.5) / 2 = 656，底部 y = 1264
const VIDEO_H = Math.round((CANVAS_W * 9) / 16); // 607
const VIDEO_Y = Math.round((CANVAS_H - VIDEO_H) / 2); // 656
const VIDEO_BOTTOM = VIDEO_Y + VIDEO_H; // 1263

// 标题区域：视频上方 0 ~ 656，标题垂直居中
const TITLE_Y = Math.round(VIDEO_Y / 2); // 328（标题中心在视频上方区域的中点）
const TITLE_H = 120; // 标题区域高度

// 字幕区域：视频下方 1263 ~ 1920，字幕垂直居中
const SUBTITLE_Y = VIDEO_BOTTOM + Math.round((CANVAS_H - VIDEO_BOTTOM) / 2) - 60; // 1590（字幕中心在视频下方区域的中点）
const SUBTITLE_H = 140; // 字幕区域高度

// Chrome 可执行文件路径
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ─── Puppeteer 单例 ──────────────────────────────────────────────────
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });
  return _browser;
}

/**
 * 用 Puppeteer 截图 HTML，输出透明背景 PNG
 */
async function htmlToPng(html: string, outputPath: string, width: number, height: number): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: outputPath, type: 'png', omitBackground: true });
    return outputPath;
  } finally {
    await page.close();
  }
}

// ─── HTML 模板：标题覆盖层 ───────────────────────────────────────────

function buildTitleHtml(title: string): string {
  const escaped = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 120);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${CANVAS_W}px;
    height: ${TITLE_H}px;
    font-family: 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    padding: 0 40px;
  }
  .title {
    color: #ffffff;
    font-size: 40px;
    font-weight: 700;
    text-align: center;
    line-height: 1.3;
    letter-spacing: 0.5px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.5);
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
</head>
<body>
  <div class="title">${escaped}</div>
</body>
</html>`;
}

// ─── HTML 模板：字幕覆盖层（单条字幕） ──────────────────────────────

function buildSubtitleHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${CANVAS_W}px;
    height: ${SUBTITLE_H}px;
    font-family: 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    padding: 0 40px;
  }
  .subtitle {
    color: #ffffff;
    font-size: 30px;
    font-weight: 500;
    text-align: center;
    line-height: 1.35;
    letter-spacing: 0.3px;
    text-shadow: 0 2px 6px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6);
    background: rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    padding: 8px 16px;
    max-width: 1000px;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
</head>
<body>
  <div class="subtitle">${escaped}</div>
</body>
</html>`;
}

// ─── 字幕处理 ────────────────────────────────────────────────────────

function prepareSubtitles(
  subtitles: SubtitleSegment[],
  clipStartSec: number,
  clipEndSec: number
): Array<{ text: string; tStart: number; tEnd: number }> {
  return subtitles
    .map(s => ({
      tStart: Math.max(0, s.start - clipStartSec),
      tEnd: Math.min(clipEndSec - clipStartSec, s.end - clipStartSec),
      text: s.text.replace(/\n/g, ' ').trim(),
    }))
    .filter(s => s.tEnd > s.tStart && s.text.length > 0)
    .sort((a, b) => a.tStart - b.tStart);
}

// ─── 生成覆盖层图片 ─────────────────────────────────────────────────

async function renderTitleOverlay(clipId: number, title: string): Promise<string> {
  const pngPath = path.join(TEMP_DIR, `overlay-${clipId}-title.png`);
  if (fs.existsSync(pngPath) && fs.statSync(pngPath).size > 1000) return pngPath;
  const html = buildTitleHtml(title);
  return htmlToPng(html, pngPath, CANVAS_W, TITLE_H);
}

async function renderSubtitleOverlays(
  clipId: number,
  subtitles: Array<{ text: string; tStart: number; tEnd: number }>
): Promise<Array<{ pngPath: string; tStart: number; tEnd: number }>> {
  if (subtitles.length === 0) return [];

  const results: Array<{ pngPath: string; tStart: number; tEnd: number }> = [];

  for (let i = 0; i < subtitles.length; i++) {
    const { text, tStart, tEnd } = subtitles[i];
    const pngPath = path.join(TEMP_DIR, `overlay-${clipId}-sub-${i}.png`);
    if (!fs.existsSync(pngPath) || fs.statSync(pngPath).size < 1000) {
      const html = buildSubtitleHtml(text);
      await htmlToPng(html, pngPath, CANVAS_W, SUBTITLE_H);
    }
    results.push({ pngPath, tStart, tEnd });
  }

  return results;
}

// ─── 视频下载 ────────────────────────────────────────────────────────

async function downloadSegment(videoId: string, start: number, end: number): Promise<string> {
  const outPath = path.join(TEMP_DIR, `${videoId}_${start}_${end}.mp4`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) return outPath;

  const ytDlpBin = path.resolve(process.cwd(), '.venv', 'bin', 'yt-dlp');

  return new Promise((resolve, reject) => {
    const args = [
      '--no-warnings', '--no-call-home',
      '-f', 'best[height<=720][ext=mp4]/best[height<=720]/best',
      '--download-sections', `*${start}-${end}`,
      '--force-keyframes-at-cuts',
      '-o', outPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const proc = spawn(ytDlpBin, args);
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code: number) => {
      if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
        resolve(outPath);
      } else {
        reject(new Error(`yt-dlp failed: ${stderr}`));
      }
    });
    proc.on('error', reject);
  });
}

// ─── 主渲染函数 ──────────────────────────────────────────────────────

/**
 * Render a vertical short video (9:16).
 *
 * 两层结构：
 *   背景层：模糊视频撑满 1080×1920
 *   内容层：
 *     - 标题区域（顶部 160px）— 垂直居中在模糊背景上
 *     - 视频区域（中间 1580px）— 原视频保持比例居中
 *     - 字幕区域（底部 180px）— 垂直居中在模糊背景上，逐句显示
 */
export async function renderVerticalVideo(clip: ClipData): Promise<string> {
  const outputFileName = `clip-${clip.id}-vertical.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000) {
    console.log(`[VerticalRenderer] Video already exists: ${outputPath}`);
    return outputPath;
  }

  // Step 1: Download video segment
  console.log(`[VerticalRenderer] Downloading segment for clip ${clip.id}...`);
  const segmentPath = await downloadSegment(clip.video_id, clip.start_sec, clip.end_sec);

  // Step 2: 处理字幕（转换为相对时间）
  const preparedSubs = prepareSubtitles(clip.subtitles || [], clip.start_sec, clip.end_sec);
  console.log(`[VerticalRenderer] ${preparedSubs.length} subtitle segments prepared`);

  // Step 3: 渲染标题覆盖层
  console.log(`[VerticalRenderer] Rendering title overlay...`);
  const titlePng = clip.title ? await renderTitleOverlay(clip.id, clip.title) : '';

  // Step 4: 渲染字幕覆盖层（每条字幕一张 PNG）
  console.log(`[VerticalRenderer] Rendering subtitle overlays...`);
  const subtitleOverlays = await renderSubtitleOverlays(clip.id, preparedSubs);

  // Step 5: 构建 FFmpeg filter_complex
  console.log(`[VerticalRenderer] Compositing video...`);

  const filterParts: string[] = [];

  // 5a: 缩放源视频
  filterParts.push('[0:v]scale=1080:-2:force_original_aspect_ratio=decrease[scaled]');

  // 5b: 创建模糊背景（撑满 1080×1920）
  filterParts.push('[scaled]split[bg_orig][fg]');
  filterParts.push(
    `[bg_orig]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=luma_radius=20:luma_power=3[bg]`
  );

  // 5c: 前景视频居中叠加在模糊背景上
  filterParts.push(
    `[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto[video]`
  );

  // 5d: 叠加标题（在视频上方区域垂直居中）
  let currentLabel = 'video';
  if (titlePng) {
    filterParts.push(
      `[${currentLabel}][1:v]overlay=0:${Math.round(TITLE_Y - TITLE_H / 2)}:format=auto[with_title]`
    );
    currentLabel = 'with_title';
  }

  // 5e: 叠加字幕（在视频下方区域垂直居中，按时间显示）
  if (subtitleOverlays.length > 0) {
    for (let i = 0; i < subtitleOverlays.length; i++) {
      const { tStart, tEnd } = subtitleOverlays[i];
      // 输入序号: 2+i (0=视频, 1=标题, 2+=字幕)
      const inputIdx = (titlePng ? 2 : 1) + i;
      const nextLabel = i === subtitleOverlays.length - 1 ? 'outv' : `sub_${i}`;
      // 字幕叠加在视频下方区域垂直居中
      const subtitleY = Math.round(SUBTITLE_Y - SUBTITLE_H / 2);
      filterParts.push(
        `[${currentLabel}][${inputIdx}:v]overlay=0:${subtitleY}:enable='between(t\\,${tStart.toFixed(2)}\\,${tEnd.toFixed(2)})':format=auto[${nextLabel}]`
      );
      currentLabel = nextLabel;
    }
  } else {
    filterParts.push(`[${currentLabel}]copy[outv]`);
  }

  const filterComplex = filterParts.join(';');

  // Step 6: 构建 FFmpeg 输入参数
  const ffmpegInputs: string[] = ['-y', '-i', segmentPath];

  if (titlePng) {
    ffmpegInputs.push('-i', titlePng);
  }

  for (const overlay of subtitleOverlays) {
    ffmpegInputs.push('-i', overlay.pngPath);
  }

  const ffmpegArgs = [
    ...ffmpegInputs,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-shortest',
    outputPath,
  ];

  // Step 7: 运行 FFmpeg
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let stderr = '';
    ffmpeg.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    ffmpeg.on('close', (code: number) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000) {
        resolve();
      } else {
        reject(new Error(`FFmpeg vertical render failed (code=${code}): ${stderr.slice(-500)}`));
      }
    });
    ffmpeg.on('error', reject);
  });

  // Step 8: 清理临时 PNG
  try {
    if (titlePng) fs.unlinkSync(titlePng);
    for (const overlay of subtitleOverlays) {
      if (fs.existsSync(overlay.pngPath)) fs.unlinkSync(overlay.pngPath);
    }
  } catch {
    // 清理失败不影响结果
  }

  // Step 9: Update database
  try {
    db.prepare('UPDATE clips SET vertical_cover = ? WHERE id = ?').run(
      `/api/vertical-covers/${outputFileName}`,
      clip.id
    );
  } catch (e) {
    console.error(`[VerticalRenderer] Failed to update clip ${clip.id}:`, e);
  }

  console.log(`[VerticalRenderer] Video rendered: ${outputPath}`);
  return outputPath;
}

/**
 * Get rendered vertical video path
 */
export function getVerticalVideoPath(clipId: number): string | null {
  const fileName = `clip-${clipId}-vertical.mp4`;
  const outputPath = path.join(OUTPUT_DIR, fileName);
  return fs.existsSync(outputPath) ? outputPath : null;
}
