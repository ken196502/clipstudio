import { SubtitleSegment } from './youtube';

export interface Segment {
  startSec: number;
  endSec: number;
  text: string;
}

/**
 * Remove overlapping words between the end of prevText and start of currentText.
 * Checks up to 3 words of overlap (mirrors the Python reference).
 */
export function removeOverlappingWords(prevText: string, currentText: string): string {
  const prevWords = prevText.split(/\s+/);
  const currWords = currentText.split(/\s+/);
  if (prevWords.length === 0 || currWords.length === 0) return currentText;

  const maxCheck = Math.min(3, prevWords.length, currWords.length);
  let overlapCount = 0;

  for (let i = 1; i <= maxCheck; i++) {
    const prevEnd = prevWords.slice(-i).join(' ').toLowerCase();
    const currStart = currWords.slice(0, i).join(' ').toLowerCase();
    if (prevEnd === currStart) {
      overlapCount = i;
    }
  }

  if (overlapCount > 0) {
    return currWords.slice(overlapCount).join(' ');
  }
  return currentText;
}

/**
 * Segment subtitles into logical chunks
 * Target length: 30-90 seconds
 * Split at sentence boundaries
 *
 * Note: subtitle deduplication / overlapping-word removal is now done
 * in youtube.ts parseVTT (two-pass, mirroring the Python reference).
 * This function only handles semantic segmentation.
 */
export function segmentSubtitles(subtitles: SubtitleSegment[]): Segment[] {
  if (!subtitles || subtitles.length === 0) {
    return [];
  }

  const segments: Segment[] = [];
  let currentSegment: SubtitleSegment[] = [];
  let currentStart = subtitles[0].start;
  let currentEnd = subtitles[0].end;

  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i];
    const nextSubtitle = subtitles[i + 1];

    currentSegment.push(subtitle);
    currentEnd = subtitle.end;

    const duration = currentEnd - currentStart;

    // Check if we should end the segment
    const shouldEnd = shouldEndSegment(
      subtitle.text,
      nextSubtitle?.text,
      duration,
      i === subtitles.length - 1
    );

    if (shouldEnd) {
      // Merge short segments
      if (duration < 15 && i < subtitles.length - 1) {
        continue;
      }

      // Create segment with cleaned text
      const text = currentSegment.map(s => s.text).join(' ');
      segments.push({
        startSec: currentStart,
        endSec: currentEnd,
        text: text.trim()
      });

      // Reset for next segment
      currentSegment = [];
      currentStart = nextSubtitle?.start || currentEnd;
    }
  }

  // Handle remaining subtitles
  if (currentSegment.length > 0) {
    const text = currentSegment.map(s => s.text).join(' ');
    segments.push({
      startSec: currentStart,
      endSec: currentEnd,
      text: text.trim()
    });
  }

  return segments;
}

/**
 * Determine if we should end the current segment
 */
function shouldEndSegment(
  currentText: string,
  nextText: string | undefined,
  duration: number,
  isLast: boolean
): boolean {
  // Always end at the last subtitle
  if (isLast) {
    return true;
  }

  // End if segment is too long (> 90 seconds)
  if (duration > 90) {
    return true;
  }

  // End if segment is long enough (> 60 seconds) and we're at a sentence boundary
  if (duration > 60 && isSentenceBoundary(currentText)) {
    return true;
  }

  // End if we're at a strong sentence boundary and segment is reasonable length (> 30 seconds)
  if (duration > 30 && isStrongSentenceBoundary(currentText)) {
    return true;
  }

  return false;
}

/**
 * Check if text ends with a sentence boundary
 * 支持中英文标点、省略号、引号闭合
 */
function isSentenceBoundary(text: string): boolean {
  const trimmed = text.trim();
  // 基本句子结束标点 + 省略号
  if (!/[.!?。！？…]$/.test(trimmed)) {
    return false;
  }

  // 检查引号是否闭合
  const openQuotes = (trimmed.match(/[「"'【（《]/g) || []).length;
  const closeQuotes = (trimmed.match(/[」"'】）》]/g) || []).length;

  return openQuotes === closeQuotes;
}

/**
 * Check if text ends with a strong sentence boundary
 */
function isStrongSentenceBoundary(text: string): boolean {
  const trimmed = text.trim();
  // 强句子边界：标点后有结束感
  return /[.!?。！？…]\s*$/.test(trimmed) && isSentenceBoundary(text);
}

/**
 * Merge short segments with neighbors
 */
export function mergeShortSegments(segments: Segment[], minDuration: number = 15): Segment[] {
  if (segments.length <= 1) {
    return segments;
  }

  const merged: Segment[] = [];
  let currentSegment = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    const duration = currentSegment.endSec - currentSegment.startSec;

    if (duration < minDuration) {
      // Merge with next segment
      currentSegment = {
        startSec: currentSegment.startSec,
        endSec: segment.endSec,
        text: `${currentSegment.text} ${segment.text}`
      };
    } else {
      merged.push(currentSegment);
      currentSegment = segment;
    }
  }

  // Add the last segment
  merged.push(currentSegment);

  return merged;
}
