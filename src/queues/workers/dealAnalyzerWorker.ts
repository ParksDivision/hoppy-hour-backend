import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../../config/redis';
import { logger } from '../../utils/logger';
import {
  analyzeWebsiteForDeals,
  analyzeInstagramForDeals,
  analyzeFacebookForDeals,
  analyzeTwitterForDeals,
} from '../../services/dealAnalyzer/service';
import {
  upsertRawDealAnalysis,
  findBusinessesWithoutDealAnalysis,
} from '../../repositories/rawDealAnalysisRepository';
import { addBulkAnalyzeJobs } from '../jobs/dealAnalyzerJobs';
import {
  aggregateAndStagePendingDeals,
  publishDeal,
  unpublishDeal,
} from '../../services/dealPublisher/service';
import type {
  AnalyzeBusinessJobData,
  DealSourceType,
  TriggerDealAnalysisJobData,
  PublishDealJobData,
} from '../../services/dealAnalyzer/types';

type BusinessWithLinks = Awaited<ReturnType<typeof findBusinessesWithoutDealAnalysis>>[number];

/** Map sourceType to the BusinessSocialLink URL field */
const SOURCE_URL_FIELD: Record<
  DealSourceType,
  'websiteUrl' | 'instagramUrl' | 'facebookUrl' | 'twitterUrl'
> = {
  website: 'websiteUrl',
  instagram: 'instagramUrl',
  facebook: 'facebookUrl',
  twitter: 'twitterUrl',
};

/**
 * Handle triggerDealAnalysis: queries DB for businesses not yet analyzed,
 * then dispatches individual analysis jobs.
 */
const handleTriggerDealAnalysis = async (job: Job<TriggerDealAnalysisJobData>) => {
  const { sourceType = 'website', requestedBy = 'system' } = job.data;

  logger.info({ jobId: job.id, sourceType }, 'Processing triggerDealAnalysis job');

  await job.updateProgress(10);

  const businesses = await findBusinessesWithoutDealAnalysis(sourceType);

  await job.updateProgress(30);

  if (businesses.length === 0) {
    logger.info({ jobId: job.id }, 'No businesses found needing deal analysis');
    return { success: true, count: 0, message: 'No businesses found needing deal analysis' };
  }

  const urlField = SOURCE_URL_FIELD[sourceType];
  const analyzeJobs: AnalyzeBusinessJobData[] = businesses
    .filter((b: BusinessWithLinks) => b[urlField] != null)
    .map((b: BusinessWithLinks) => ({
      googleRawBusinessId: b.googleRawBusiness.id,
      businessName: b.googleRawBusiness.name,
      sourceUrl: b[urlField] as string,
      sourceType,
      requestedBy,
    }));

  await job.updateProgress(50);

  await addBulkAnalyzeJobs(analyzeJobs);

  await job.updateProgress(100);

  logger.info(
    { jobId: job.id, businessCount: analyzeJobs.length },
    'Dispatched deal analysis jobs'
  );

  return { success: true, count: analyzeJobs.length, sourceType };
};

/**
 * Handle analyzeBusinessDeals: analyze a single business source for deals,
 * save raw results, then re-aggregate pending deals.
 */
const handleAnalyzeBusinessDeals = async (job: Job<AnalyzeBusinessJobData>) => {
  const {
    googleRawBusinessId,
    businessName,
    sourceUrl,
    sourceType,
    requestedBy = 'system',
  } = job.data;

  logger.info(
    { jobId: job.id, businessName, sourceUrl, sourceType },
    'Processing analyzeBusinessDeals job'
  );

  await job.updateProgress(10);

  // Route to platform-specific analysis function
  const socialOptions = { googleRawBusinessId, requestedBy };
  let result;
  switch (sourceType) {
    case 'instagram':
      result = await analyzeInstagramForDeals(sourceUrl, socialOptions);
      break;
    case 'facebook':
      result = await analyzeFacebookForDeals(sourceUrl, socialOptions);
      break;
    case 'twitter':
      result = await analyzeTwitterForDeals(sourceUrl, socialOptions);
      break;
    case 'website':
    default:
      result = await analyzeWebsiteForDeals(sourceUrl);
      break;
  }

  await job.updateProgress(50);

  // Persist raw analysis to DB
  await upsertRawDealAnalysis(
    {
      googleRawBusinessId,
      sourceType,
      sourceUrl,
      deals: result.deals,
      rawAiResponse: result.rawAiResponse,
      aiModel: result.aiModel,
      aiPromptVersion: result.promptVersion,
      analysisStatus: result.status,
      errorMessage: result.errorMessage ?? null,
      analyzedAt: new Date(),
    },
    requestedBy
  );

  await job.updateProgress(60);

  // Re-aggregate and stage pending deals for this business
  await aggregateAndStagePendingDeals(googleRawBusinessId, requestedBy);

  // Photos are synced in Step 3 (Google Places refresh), NOT here.
  // This avoids redundant Google API calls during deal analysis.

  await job.updateProgress(100);

  logger.info(
    {
      jobId: job.id,
      businessName,
      sourceUrl,
      status: result.status,
      dealCount: result.deals.length,
      durationMs: result.durationMs,
    },
    'Completed analyzeBusinessDeals job'
  );

  return {
    success: true,
    businessName,
    sourceUrl,
    status: result.status,
    dealCount: result.deals.length,
    durationMs: result.durationMs,
  };
};

/**
 * Handle publishDeal: copy pending deal to production.
 */
const handlePublishDeal = async (job: Job<PublishDealJobData>) => {
  const { googleRawBusinessId, publishedBy } = job.data;

  logger.info({ jobId: job.id, businessId: googleRawBusinessId }, 'Processing publishDeal job');

  await publishDeal(googleRawBusinessId, publishedBy);

  return { success: true, googleRawBusinessId, action: 'published' };
};

/**
 * Handle unpublishDeal: remove from production and mark pending as unpublished.
 */
const handleUnpublishDeal = async (job: Job<PublishDealJobData>) => {
  const { googleRawBusinessId, publishedBy } = job.data;

  logger.info({ jobId: job.id, businessId: googleRawBusinessId }, 'Processing unpublishDeal job');

  await unpublishDeal(googleRawBusinessId, publishedBy);

  return { success: true, googleRawBusinessId, action: 'unpublished' };
};

/**
 * Main worker: routes jobs to handlers based on job name.
 */
export const dealAnalyzerWorker = new Worker(
  'deal-analyzer',
  async (job: Job) => {
    try {
      switch (job.name) {
        case 'triggerDealAnalysis':
          return await handleTriggerDealAnalysis(job as Job<TriggerDealAnalysisJobData>);

        case 'analyzeBusinessDeals':
          return await handleAnalyzeBusinessDeals(job as Job<AnalyzeBusinessJobData>);

        case 'publishDeal':
          return await handlePublishDeal(job as Job<PublishDealJobData>);

        case 'unpublishDeal':
          return await handleUnpublishDeal(job as Job<PublishDealJobData>);

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
        'Deal analyzer job processing failed'
      );
      throw error;
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 2,
    limiter: {
      max: 3,
      duration: 1000,
    },
  }
);

// Event listeners for monitoring
dealAnalyzerWorker.on('completed', (job) => {
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      duration: job.finishedOn ? job.finishedOn - (job.processedOn ?? job.timestamp) : 0,
    },
    'Deal analyzer job completed'
  );
});

dealAnalyzerWorker.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    },
    'Deal analyzer job failed'
  );
});

dealAnalyzerWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Deal analyzer worker error');
});

dealAnalyzerWorker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Deal analyzer job stalled');
});
