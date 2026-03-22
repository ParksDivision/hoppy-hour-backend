import { Queue } from 'bullmq';
import { createRedisConnection } from '../../config/redis';
import { logger } from '../../utils/logger';
import type { AnalyzeBusinessJobData } from '../../services/dealAnalyzer/types';

// Create deal analyzer queue
export const dealAnalyzerQueue = new Queue('deal-analyzer', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600,
      count: 100,
    },
    removeOnFail: {
      age: 86400,
      count: 500,
    },
  },
});

/**
 * Add a single deal analysis job for one business.
 */
export const addAnalyzeBusinessJob = async (data: AnalyzeBusinessJobData) => {
  try {
    const job = await dealAnalyzerQueue.add('analyzeBusinessDeals', data, {
      priority: 1,
    });

    logger.info(
      { jobId: job.id, businessId: data.googleRawBusinessId },
      'Added analyzeBusinessDeals job to queue'
    );

    return job;
  } catch (error) {
    logger.error({ error, data }, 'Failed to add analyzeBusinessDeals job');
    throw error;
  }
};

/**
 * Add analysis jobs in bulk with staggered delays.
 */
export const addBulkAnalyzeJobs = async (businesses: AnalyzeBusinessJobData[]) => {
  try {
    const jobs = await dealAnalyzerQueue.addBulk(
      businesses.map((business, index) => ({
        name: 'analyzeBusinessDeals',
        data: business,
        opts: {
          priority: 1,
          delay: index * 1000, // 1s stagger (heavier than social scraper)
        },
      }))
    );

    logger.info({ count: jobs.length }, 'Added bulk analyzeBusinessDeals jobs to queue');

    return jobs;
  } catch (error) {
    logger.error({ error, count: businesses.length }, 'Failed to add bulk analyze jobs');
    throw error;
  }
};

/**
 * Get deal analyzer queue statistics.
 */
export const getDealAnalyzerQueueStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      dealAnalyzerQueue.getWaitingCount(),
      dealAnalyzerQueue.getActiveCount(),
      dealAnalyzerQueue.getCompletedCount(),
      dealAnalyzerQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  } catch (error) {
    logger.error({ error }, 'Failed to get deal analyzer queue stats');
    throw error;
  }
};
