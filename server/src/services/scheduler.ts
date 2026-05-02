import cron from 'node-cron';
import cronParser from 'cron-parser';
import { db } from '../db/init';
import { addCrawlJob } from './queue';

let schedulerTask: cron.ScheduledTask | null = null;

/**
 * Check if a cron expression should run now
 */
function shouldRunNow(cronExpression: string): boolean {
  try {
    const interval = cronParser.parseExpression(cronExpression);
    const prev = interval.prev();
    const now = new Date();

    // Check if the previous run was within the last minute
    const diff = now.getTime() - prev.getTime();
    return diff < 60000; // 60 seconds
  } catch (error) {
    console.error(`Invalid cron expression: ${cronExpression}`, error);
    return false;
  }
}

/**
 * Check and trigger jobs for active KOLs
 */
async function checkAndTriggerJobs(): Promise<void> {
  try {
    console.log('[Scheduler] Checking for jobs to run...');

    // Get all active KOLs
    const kols = db.prepare('SELECT * FROM kols WHERE active = 1').all() as any[];

    for (const kol of kols) {
      try {
        const fetchPolicy = kol.fetch_policy ? JSON.parse(kol.fetch_policy) : {};
        const cronExpression = fetchPolicy.cron;

        if (!cronExpression) {
          continue;
        }

        // Check if this KOL should run now
        if (shouldRunNow(cronExpression)) {
          console.log(`[Scheduler] Triggering job for KOL: ${kol.name}`);

          // Add job to queue
          await addCrawlJob(kol.id);

          // Update last_run
          db.prepare('UPDATE kols SET last_run = ? WHERE id = ?')
            .run(new Date().toISOString(), kol.id);
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
