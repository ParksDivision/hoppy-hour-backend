import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../../config/redis';
import { logger } from '../../utils/logger';
import { scrapeWebsiteForSocialLinks } from '../../services/socialScraper/service';
import {
  upsertBusinessSocialLink,
  findBusinessesWithoutSocialLinks,
} from '../../repositories/businessSocialLinkRepository';
import { addBulkScrapeJobs } from '../jobs/socialScraperJobs';
import type {
  ScrapeBusinessJobData,
  TriggerSocialScrapingJobData,
} from '../../services/socialScraper/types';

/**
 * Handle triggerSocialScraping: runs after all city search jobs complete.
 * Queries DB for businesses with websites but no social links yet,
 * then dispatches individual scrape jobs.
 */
const handleTriggerSocialScraping = async (job: Job<TriggerSocialScrapingJobData>) => {
  const { city, requestedBy = 'system' } = job.data;

  logger.info({ jobId: job.id, city }, 'Processing triggerSocialScraping job');

  await job.updateProgress(10);

  // Query DB for businesses needing scraping
  const businesses = await findBusinessesWithoutSocialLinks();

  await job.updateProgress(30);

  if (businesses.length === 0) {
    logger.info({ jobId: job.id, city }, 'No businesses with websites found to scrape');
    return { success: true, count: 0, message: 'No businesses with websites found to scrape' };
  }

  // Map to scrape job data
  const scrapeJobs: ScrapeBusinessJobData[] = businesses.map((b) => ({
    googleRawBusinessId: b.id,
    businessName: b.name,
    websiteUrl: b.uri!,
    requestedBy,
  }));

  await job.updateProgress(50);

  // Dispatch scrape jobs in bulk
  await addBulkScrapeJobs(scrapeJobs);

  await job.updateProgress(100);

  logger.info(
    { jobId: job.id, city, businessCount: scrapeJobs.length },
    'Dispatched social scraping jobs'
  );

  return { success: true, count: scrapeJobs.length, city };
};

/**
 * Handle scrapeBusinessLinks: scrape a single business website for social media links.
 */
const handleScrapeBusinessLinks = async (job: Job<ScrapeBusinessJobData>) => {
  const { googleRawBusinessId, businessName, websiteUrl, requestedBy = 'system' } = job.data;

  logger.info({ jobId: job.id, businessName, websiteUrl }, 'Processing scrapeBusinessLinks job');

  await job.updateProgress(10);

  const result = await scrapeWebsiteForSocialLinks(websiteUrl);

  await job.updateProgress(70);

  // Persist to DB
  await upsertBusinessSocialLink(
    {
      googleRawBusinessId,
      websiteUrl,
      facebookUrl: result.links.facebook,
      instagramUrl: result.links.instagram,
      twitterUrl: result.links.twitter,
      scrapedAt: new Date(),
      scrapeMethod: result.method,
      scrapeStatus: result.status,
      errorMessage: result.errorMessage ?? null,
      rawLinksFound: result.links.allLinksFound,
    },
    requestedBy
  );

  await job.updateProgress(100);

  logger.info(
    {
      jobId: job.id,
      businessName,
      websiteUrl,
      method: result.method,
      status: result.status,
      facebook: result.links.facebook,
      instagram: result.links.instagram,
      twitter: result.links.twitter,
      durationMs: result.durationMs,
    },
    'Completed scrapeBusinessLinks job'
  );

  return {
    success: true,
    businessName,
    websiteUrl,
    method: result.method,
    status: result.status,
    facebook: result.links.facebook,
    instagram: result.links.instagram,
    twitter: result.links.twitter,
    durationMs: result.durationMs,
  };
};

/**
 * Main worker: routes jobs to handlers based on job name.
 */
export const socialScraperWorker = new Worker(
  'social-scraper',
  async (job: Job) => {
    try {
      switch (job.name) {
        case 'triggerSocialScraping':
          return await handleTriggerSocialScraping(job as Job<TriggerSocialScrapingJobData>);

        case 'scrapeBusinessLinks':
          return await handleScrapeBusinessLinks(job as Job<ScrapeBusinessJobData>);

        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      logger.error(
        {
          jobId: job.id,
          jobName: job.name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Social scraper job processing failed'
      );
      throw error;
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 1000,
    },
  }
);

// Event listeners for monitoring
socialScraperWorker.on('completed', (job) => {
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      duration: job.finishedOn ? job.finishedOn - (job.processedOn ?? job.timestamp) : 0,
    },
    'Social scraper job completed'
  );
});

socialScraperWorker.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    },
    'Social scraper job failed'
  );
});

socialScraperWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Social scraper worker error');
});

socialScraperWorker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Social scraper job stalled');
});
