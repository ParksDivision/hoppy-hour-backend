import { Queue, FlowProducer } from 'bullmq';
import { createRedisConnection } from '../../config/redis';
import { logger } from '../../utils/logger';
import type {
  ScrapeBusinessJobData,
  TriggerSocialScrapingJobData,
} from '../../services/socialScraper/types';
import type { GooglePlacesSearchOptions } from '../../services/googlePlaces/types';

// Create social scraper queue
export const socialScraperQueue = new Queue('social-scraper', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
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

// FlowProducer for chaining city search -> social scraping
export const socialScraperFlowProducer = new FlowProducer({
  connection: createRedisConnection(),
});

/**
 * Add a single scrape job for one business website.
 */
export const addScrapeBusinessJob = async (data: ScrapeBusinessJobData) => {
  try {
    const job = await socialScraperQueue.add('scrapeBusinessLinks', data, {
      priority: 1,
    });

    logger.info(
      { jobId: job.id, businessId: data.googleRawBusinessId },
      'Added scrapeBusinessLinks job to queue'
    );

    return job;
  } catch (error) {
    logger.error({ error, data }, 'Failed to add scrapeBusinessLinks job');
    throw error;
  }
};

/**
 * Add scrape jobs in bulk with staggered delays.
 */
export const addBulkScrapeJobs = async (businesses: ScrapeBusinessJobData[]) => {
  try {
    const jobs = await socialScraperQueue.addBulk(
      businesses.map((business, index) => ({
        name: 'scrapeBusinessLinks',
        data: business,
        opts: {
          priority: 1,
          delay: index * 500, // 500ms stagger between jobs
        },
      }))
    );

    logger.info({ count: jobs.length }, 'Added bulk scrapeBusinessLinks jobs to queue');

    return jobs;
  } catch (error) {
    logger.error({ error, count: businesses.length }, 'Failed to add bulk scrape jobs');
    throw error;
  }
};

/**
 * Create a FlowProducer flow that chains city search -> social scraping.
 * Parent (triggerSocialScraping) fires after all children (searchNearby) complete.
 */
export const addCitySearchWithSocialScrapingFlow = async (
  locations: Array<{
    latitude: number;
    longitude: number;
    options?: GooglePlacesSearchOptions;
  }>,
  city: string,
  requestedBy?: string
) => {
  try {
    const children = locations.map((location, index) => ({
      name: 'searchNearby',
      queueName: 'google-places',
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        options: location.options,
        requestedBy: requestedBy ?? 'system',
      },
      opts: {
        priority: 1,
        delay: index * 1000,
        removeDependencyOnFailure: true,
      },
    }));

    const flow = await socialScraperFlowProducer.add({
      name: 'triggerSocialScraping',
      queueName: 'social-scraper',
      data: {
        city,
        requestedBy: requestedBy ?? 'system',
      } satisfies TriggerSocialScrapingJobData,
      children,
    });

    logger.info(
      { city, childJobCount: children.length, parentJobId: flow.job.id },
      'Created city search -> social scraping flow'
    );

    return flow;
  } catch (error) {
    logger.error({ error, city }, 'Failed to create city search with social scraping flow');
    throw error;
  }
};

/**
 * Get social scraper queue statistics.
 */
export const getSocialScraperQueueStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      socialScraperQueue.getWaitingCount(),
      socialScraperQueue.getActiveCount(),
      socialScraperQueue.getCompletedCount(),
      socialScraperQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  } catch (error) {
    logger.error({ error }, 'Failed to get social scraper queue stats');
    throw error;
  }
};
