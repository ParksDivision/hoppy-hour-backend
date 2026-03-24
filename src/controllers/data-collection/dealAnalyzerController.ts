import { Request, Response } from 'express';
import {
  addAnalyzeBusinessJob,
  addBulkAnalyzeJobs,
  getDealAnalyzerQueueStats,
} from '../../queues/jobs/dealAnalyzerJobs';
import {
  findBusinessesWithoutDealAnalysis,
  findDealsByBusinessId,
  getDealAnalysisStats,
} from '../../repositories/websiteDealDataRepository';
import { findGoogleRawBusinessById } from '../../repositories/googleRawBusinessRepository';
import { findSocialLinksByBusinessId } from '../../repositories/businessSocialLinkRepository';
import { logger } from '../../utils/logger';
import type { DealSourceType, AnalyzeBusinessJobData } from '../../services/dealAnalyzer/types';

const ALL_SOURCE_TYPES: DealSourceType[] = ['website', 'instagram', 'facebook', 'twitter'];

/** Map sourceType to the corresponding URL field on BusinessSocialLink */
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
 * POST /api/data-collection/deals/analyze
 * Manually trigger deal analysis for a single business by ID.
 * Queues jobs for all available source URLs (website, instagram, facebook, twitter).
 */
export const analyzeBusinessDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { googleRawBusinessId, sourceType } = req.body;

    if (!googleRawBusinessId || typeof googleRawBusinessId !== 'string') {
      res.status(400).json({ error: 'googleRawBusinessId is required' });
      return;
    }

    // Verify business exists
    const business = await findGoogleRawBusinessById(googleRawBusinessId);
    if (!business) {
      res.status(404).json({ error: 'Business not found' });
      return;
    }

    // Get social links for this business
    const socialLinks = await findSocialLinksByBusinessId(googleRawBusinessId);

    // Determine which sources to analyze
    const sourcesToAnalyze: DealSourceType[] = sourceType
      ? [sourceType as DealSourceType]
      : ALL_SOURCE_TYPES;

    // Build jobs for each available source URL
    const jobs: { sourceType: DealSourceType; sourceUrl: string; jobId: string | undefined }[] = [];

    for (const st of sourcesToAnalyze) {
      const urlField = SOURCE_URL_FIELD[st];
      const url =
        st === 'website' ? (socialLinks?.[urlField] ?? business.uri) : socialLinks?.[urlField];

      if (!url) continue;

      const job = await addAnalyzeBusinessJob({
        googleRawBusinessId: business.id,
        businessName: business.name,
        sourceUrl: url,
        sourceType: st,
        requestedBy: req.ip ?? 'unknown',
      });

      jobs.push({ sourceType: st, sourceUrl: url, jobId: job.id });
    }

    if (jobs.length === 0) {
      res.status(400).json({ error: 'Business has no URLs to analyze' });
      return;
    }

    logger.info(
      { businessId: business.id, jobCount: jobs.length },
      'Deal analysis jobs queued for single business'
    );

    res.status(202).json({
      message: `${jobs.length} deal analysis job(s) queued`,
      jobs,
      status: 'queued',
      businessName: business.name,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue deal analysis job');
    res.status(500).json({ error: 'Failed to queue deal analysis job' });
  }
};

/**
 * POST /api/data-collection/deals/analyze/pending
 * Trigger analysis for all businesses across all platforms not yet analyzed.
 * Queues website, Instagram, Facebook, and Twitter analysis jobs together.
 */
export const analyzePendingBusinesses = async (req: Request, res: Response): Promise<void> => {
  try {
    const allJobs: AnalyzeBusinessJobData[] = [];
    const breakdown: Record<string, number> = {};

    for (const st of ALL_SOURCE_TYPES) {
      const urlField = SOURCE_URL_FIELD[st];
      const businesses = await findBusinessesWithoutDealAnalysis(st);

      const platformJobs: AnalyzeBusinessJobData[] = businesses
        .filter((b: Record<string, unknown>) => b[urlField] != null)
        .map((b: Record<string, unknown>) => ({
          googleRawBusinessId: (b.googleRawBusiness as { id: string; name: string }).id,
          businessName: (b.googleRawBusiness as { id: string; name: string }).name,
          sourceUrl: b[urlField] as string,
          sourceType: st,
          requestedBy: req.ip ?? 'unknown',
        }));

      allJobs.push(...platformJobs);
      breakdown[st] = platformJobs.length;
    }

    if (allJobs.length === 0) {
      res.json({
        message: 'No businesses pending deal analysis',
        count: 0,
        breakdown,
      });
      return;
    }

    const jobs = await addBulkAnalyzeJobs(allJobs);

    logger.info(
      { count: jobs.length, breakdown, ip: req.ip },
      'Bulk deal analysis jobs queued for all platforms'
    );

    res.status(202).json({
      message: `${jobs.length} deal analysis jobs queued`,
      count: jobs.length,
      breakdown,
      status: 'queued',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue pending deal analysis jobs');
    res.status(500).json({ error: 'Failed to queue deal analysis jobs' });
  }
};

/**
 * GET /api/data-collection/deals/:businessId
 * Get deal data for a specific business.
 */
export const getBusinessDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.params;

    if (!businessId) {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    const deals = await findDealsByBusinessId(businessId);

    if (!deals || deals.length === 0) {
      res.status(404).json({ error: 'No deal data found for this business' });
      return;
    }

    res.json(deals);
  } catch (error) {
    logger.error({ error, businessId: req.params.businessId }, 'Failed to fetch deal data');
    res.status(500).json({ error: 'Failed to fetch deal data' });
  }
};

/**
 * GET /api/data-collection/deals/stats
 * Get deal analysis statistics.
 */
export const getDealStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getDealAnalysisStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch deal analysis stats');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

/**
 * GET /api/data-collection/deals/queue/stats
 * Get deal analyzer queue statistics.
 */
export const getDealQueueStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getDealAnalyzerQueueStats();

    res.json({
      queue: 'deal-analyzer',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch deal analyzer queue stats');
    res.status(500).json({ error: 'Failed to fetch queue statistics' });
  }
};
