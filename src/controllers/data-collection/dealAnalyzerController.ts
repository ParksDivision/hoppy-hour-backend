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

/**
 * POST /api/data-collection/deals/analyze
 * Manually trigger deal analysis for a single business by ID.
 */
export const analyzeBusinessDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { googleRawBusinessId } = req.body;

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

    // Check for website URL from social links or raw business
    const socialLinks = await findSocialLinksByBusinessId(googleRawBusinessId);
    const websiteUrl = socialLinks?.websiteUrl ?? business.uri;

    if (!websiteUrl) {
      res.status(400).json({ error: 'Business has no website URL to analyze' });
      return;
    }

    const job = await addAnalyzeBusinessJob({
      googleRawBusinessId: business.id,
      businessName: business.name,
      sourceUrl: websiteUrl,
      sourceType: 'website',
      requestedBy: req.ip ?? 'unknown',
    });

    logger.info(
      { jobId: job.id, businessId: business.id },
      'Deal analysis job queued for single business'
    );

    res.status(202).json({
      message: 'Deal analysis job queued',
      jobId: job.id,
      status: 'queued',
      businessName: business.name,
      websiteUrl,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue deal analysis job');
    res.status(500).json({ error: 'Failed to queue deal analysis job' });
  }
};

/**
 * POST /api/data-collection/deals/analyze/pending
 * Trigger analysis for all businesses with websites not yet analyzed.
 */
export const analyzePendingBusinesses = async (req: Request, res: Response): Promise<void> => {
  try {
    const businesses = await findBusinessesWithoutDealAnalysis('website');

    if (businesses.length === 0) {
      res.json({
        message: 'No businesses pending deal analysis',
        count: 0,
      });
      return;
    }

    const analyzeJobs = businesses.map((b) => ({
      googleRawBusinessId: b.googleRawBusiness.id,
      businessName: b.googleRawBusiness.name,
      sourceUrl: b.websiteUrl!,
      sourceType: 'website' as const,
      requestedBy: req.ip ?? 'unknown',
    }));

    const jobs = await addBulkAnalyzeJobs(analyzeJobs);

    logger.info(
      { count: jobs.length, ip: req.ip },
      'Bulk deal analysis jobs queued for pending businesses'
    );

    res.status(202).json({
      message: `${jobs.length} deal analysis jobs queued`,
      count: jobs.length,
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
