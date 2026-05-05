import cron from 'node-cron';
import cronParser from 'cron-parser';
import { db } from '../db/init';
import { processJob } from './job-processor';
import { notifyJobsChanged } from './job-broadcast';

let schedulerTask: cron.ScheduledTask | null = null;

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
