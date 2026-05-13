import cron from 'node-cron';
import cronParser from 'cron-parser';
import { db } from '../db/init';
import { processJob } from './job-processor';
import { notifyJobsChanged } from './job-broadcast';
import { renderVerticalVideo, getVerticalVideoPath } from './vertical-renderer';

let schedulerTask: cron.ScheduledTask | null = null;
let verticalRenderInProgress = false;

/**
 * True when the latest scheduled occurrence is strictly after effectiveLastTs and not in the future.
 *
 * Important: comparing "prev fired within last 60s" only works for "* * * * *"; hourly/daily/weekly
 * expressions would otherwise miss forever after the first minute boundary.
 *
 * effectiveLastTs: last successful schedule tick (kol.last_run) or kol.created_at if never ran.
 */
function cronPrevMsBeforeNow(cronExpression: string, nowMs: number): number | null {
  try {
    const interval = cronParser.parseExpression(cronExpression, {
      currentDate: new Date(nowMs),
    });
    return interval.prev().getTime();
  } catch (error) {
    console.error(`Invalid cron expression: ${cronExpression}`, error);
    return null;
  }
}

function kolEffectiveLastRunMs(kol: { last_run: string | null; created_at: string }): number {
  if (kol.last_run) {
    const t = Date.parse(kol.last_run);
    if (!Number.isNaN(t)) return t;
  }
  const created = Date.parse(kol.created_at);
  return Number.isNaN(created) ? 0 : created;
}

function hasActiveJobForKol(kolId: number): boolean {
  const row = db.prepare(`
    SELECT id
    FROM jobs
    WHERE kol_id = ?
      AND status IN ('running', 'pending')
    ORDER BY id DESC
    LIMIT 1
  `).get(kolId) as { id: number } | undefined;
  return Boolean(row);
}

/**
 * Check and trigger jobs for active KOLs
 */
async function checkAndTriggerJobs(): Promise<void> {
  try {
    // Get all active KOLs
    const kols = db.prepare('SELECT * FROM kols WHERE active = 1').all() as any[];

    for (const kol of kols) {
      try {
        const fetchPolicy = kol.fetch_policy ? JSON.parse(kol.fetch_policy) : {};
        const cronExpression = fetchPolicy.cron;

        if (!cronExpression) {
          continue;
        }

        const nowMs = Date.now();
        const effectiveLastTs = kolEffectiveLastRunMs({
          last_run: kol.last_run ?? null,
          created_at: kol.created_at ?? '',
        });

        const slotTs = cronPrevMsBeforeNow(cronExpression, nowMs);
        if (
          slotTs !== null &&
          slotTs > effectiveLastTs &&
          slotTs <= nowMs
        ) {
          if (hasActiveJobForKol(kol.id)) {
            console.log(`[Scheduler] Skip ${kol.name}: active job already exists`);
            continue;
          }

          console.log(`[Scheduler] Triggering job for KOL: ${kol.name}`);

          // Create a job entry
          const result = db.prepare(`
            INSERT INTO jobs (kol_id, status, stage, progress, started_at)
            VALUES (?, 'running', 'crawl', 0, ?)
          `).run(kol.id, new Date().toISOString());

          const jobId = result.lastInsertRowid as number;

          // Process the job in background
          processJob(jobId).catch(error => {
            console.error(`[Scheduler] Error processing job ${jobId}:`, error);
          });

          notifyJobsChanged(true);

          // Book the cron slot timestamp (prevents repeats within same slot vs next tick)
          db.prepare('UPDATE kols SET last_run = ? WHERE id = ?')
            .run(new Date(slotTs).toISOString(), kol.id);
        }
      } catch (error) {
        console.error(`[Scheduler] Failed to check KOL ${kol.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Failed to check and trigger jobs:', error);
  }
}

/**
 * Batch pre-render vertical videos for clips that don't have them yet.
 * Runs in the background so users don't wait when clicking download.
 */
async function preRenderVerticalVideos(): Promise<void> {
  if (verticalRenderInProgress) {
    console.log('[Scheduler] Vertical pre-render already in progress, skipping');
    return;
  }

  try {
    verticalRenderInProgress = true;

    // Find clips without vertical_cover or whose file doesn't exist
    const clips = db.prepare(`
      SELECT c.id, c.video_id, c.kol_name, c.start_sec, c.end_sec, c.title, c.thumbnail, c.subtitles
      FROM clips c
      WHERE c.vertical_cover IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM clips c2
           WHERE c2.id = c.id
           AND c2.vertical_cover LIKE '%vertical-covers%'
         )
      ORDER BY c.created_at DESC
      LIMIT 5
    `).all() as any[];

    if (clips.length === 0) {
      return;
    }

    console.log(`[Scheduler] Pre-rendering ${clips.length} vertical videos...`);

    for (const clip of clips) {
      // Double-check file doesn't already exist on disk
      const existingPath = getVerticalVideoPath(clip.id);
      if (existingPath) {
        // Update database if file exists but DB record is missing
        try {
          const fileName = `clip-${clip.id}-vertical.mp4`;
          db.prepare('UPDATE clips SET vertical_cover = ? WHERE id = ?').run(
            `/api/vertical-covers/${fileName}`,
            clip.id
          );
          console.log(`[Scheduler] Updated DB for existing vertical video: clip ${clip.id}`);
        } catch (e) {
          console.error(`[Scheduler] Failed to update DB for clip ${clip.id}:`, e);
        }
        continue;
      }

      try {
        console.log(`[Scheduler] Pre-rendering vertical video for clip ${clip.id}...`);
        await renderVerticalVideo({
          id: clip.id,
          video_id: clip.video_id,
          kol_name: clip.kol_name,
          start_sec: clip.start_sec,
          end_sec: clip.end_sec,
          title: clip.title,
          thumbnail: clip.thumbnail,
          subtitles: clip.subtitles ? JSON.parse(clip.subtitles) : undefined,
        });
        console.log(`[Scheduler] Pre-rendered vertical video for clip ${clip.id}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to pre-render vertical video for clip ${clip.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error in preRenderVerticalVideos:', error);
  } finally {
    verticalRenderInProgress = false;
  }
}

/**
 * Start the scheduler
 */
export function startScheduler(): void {
  if (schedulerTask) {
    console.log('[Scheduler] Scheduler already running');
    return;
  }

  console.log('[Scheduler] Starting scheduler...');

  // Run every minute
  schedulerTask = cron.schedule('* * * * *', async () => {
    await checkAndTriggerJobs();
    // Also trigger vertical video pre-rendering in background
    preRenderVerticalVideos().catch(error => {
      console.error('[Scheduler] Error in preRenderVerticalVideos:', error);
      verticalRenderInProgress = false;
    });
  });

  console.log('[Scheduler] Scheduler started (runs every minute)');
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('[Scheduler] Scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): { running: boolean } {
  return {
    running: schedulerTask !== null,
  };
}
