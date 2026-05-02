import Queue from 'bull';
import { db } from '../db/init';
import { processJob } from './job-processor';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Create queues
export const crawlQueue = new Queue('crawl-channel', { redis: redisConfig });
export const processQueue = new Queue('process-video', { redis: redisConfig });

/**
 * Initialize queue processors
 */
export function initializeQueues(): void {
  console.log('Initializing job queues...');

  // Crawl channel queue processor
  crawlQueue.process(async (job) => {
    const { kolId } = job.data;

    console.log(`[Crawl Queue] Processing job for KOL ${kolId}`);

    // Create a job record in the database
    const result = db.prepare(`
      INSERT INTO jobs (kol_id, stage, status, progress, started_at)
      VALUES (?, 'crawl', 'running', 0, ?)
    `).run(kolId, new Date().toISOString());

    const jobId = result.lastInsertRowid as number;

    try {
      // Process the job
      await processJob(jobId);

      // Update job progress
      job.progress(100);

      return { success: true, jobId };
    } catch (error) {
      console.error(`[Crawl Queue] Failed to process job ${jobId}:`, error);
      throw error;
    }
  });

  // Process video queue processor
  processQueue.process(async (job) => {
    const { kolId, videoId } = job.data;

    console.log(`[Process Queue] Processing video ${videoId} for KOL ${kolId}`);

    // This would be used for processing individual videos
    // For now, we'll just return success
    return { success: true };
  });

  // Handle queue events
  crawlQueue.on('completed', (job, result) => {
    console.log(`[Crawl Queue] Job ${job.id} completed:`, result);
  });

  crawlQueue.on('failed', (job, err) => {
    console.error(`[Crawl Queue] Job ${job.id} failed:`, err.message);
  });

  processQueue.on('completed', (job, result) => {
    console.log(`[Process Queue] Job ${job.id} completed:`, result);
  });

  processQueue.on('failed', (job, err) => {
    console.error(`[Process Queue] Job ${job.id} failed:`, err.message);
  });

  console.log('Job queues initialized successfully');
}

/**
 * Add a crawl job to the queue
 */
export async function addCrawlJob(kolId: number): Promise<void> {
  await crawlQueue.add({ kolId }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 10, // Keep last 10 completed jobs
      age: 24 * 60 * 60, // Remove jobs older than 24 hours
    },
    removeOnFail: {
      count: 5, // Keep last 5 failed jobs
      age: 7 * 24 * 60 * 60, // Remove jobs older than 7 days
    },
  });
  console.log(`[Crawl Queue] Added job for KOL ${kolId}`);
}

/**
 * Add a process job to the queue
 */
export async function addProcessJob(kolId: number, videoId: string): Promise<void> {
  await processQueue.add({ kolId, videoId }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 10,
      age: 24 * 60 * 60,
    },
    removeOnFail: {
      count: 5,
      age: 7 * 24 * 60 * 60,
    },
  });
  console.log(`[Process Queue] Added job for video ${videoId}`);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<any> {
  const crawlWaiting = await crawlQueue.getWaitingCount();
  const crawlActive = await crawlQueue.getActiveCount();
  const crawlCompleted = await crawlQueue.getCompletedCount();
  const crawlFailed = await crawlQueue.getFailedCount();

  const processWaiting = await processQueue.getWaitingCount();
  const processActive = await processQueue.getActiveCount();
  const processCompleted = await processQueue.getCompletedCount();
  const processFailed = await processQueue.getFailedCount();

  return {
    crawl: {
      waiting: crawlWaiting,
      active: crawlActive,
      completed: crawlCompleted,
      failed: crawlFailed,
    },
    process: {
      waiting: processWaiting,
      active: processActive,
      completed: processCompleted,
      failed: processFailed,
    },
  };
}

/**
 * Close queues gracefully
 */
export async function closeQueues(): Promise<void> {
  await crawlQueue.close();
  await processQueue.close();
  console.log('Job queues closed');
}
