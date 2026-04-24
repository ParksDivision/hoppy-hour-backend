import { Request, Response } from 'express';
import {
  addScrapeBusinessJob,
  addBulkScrapeJobs,
  getSocialScraperQueueStats,
} from '../../queues/jobs/socialScraperJobs';
import {
  findBusinessesWithoutSocialLinks,
  findSocialLinksByBusinessId,
  getSocialLinkStats,
} from '../../repositories/businessSocialLinkRepository';
import { findGoogleRawBusinessById, getAllGoogleRawBusinesses } from '../../repositories/googleRawBusinessRepository';
import { logger } from '../../utils/logger';

/**
 * POST /api/data-collection/social/scrape
 * Manually trigger social scraping for a single business by ID.
 */
export const scrapeBusinessSocialLinks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { googleRawBusinessId } = req.body;

    if (!googleRawBusinessId || typeof googleRawBusinessId !== 'string') {
      res.status(400).json({ error: 'googleRawBusinessId is required' });
      return;
    }

    // Verify business exists and has a website
    const business = await findGoogleRawBusinessById(googleRawBusinessId);
    if (!business) {
      res.status(404).json({ error: 'Business not found' });
      return;
    }

    if (!business.uri) {
      res.status(400).json({ error: 'Business has no website URL to scrape' });
      return;
    }

    const job = await addScrapeBusinessJob({
      googleRawBusinessId: business.id,
      businessName: business.name,
      websiteUrl: business.uri,
      requestedBy: req.ip ?? 'unknown',
    });

    logger.info(
      { jobId: job.id, businessId: business.id },
      'Social scraping job queued for single business'
    );

    res.status(202).json({
      message: 'Social scraping job queued',
      jobId: job.id,
      status: 'queued',
      businessName: business.name,
      websiteUrl: business.uri,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue social scraping job');
    res.status(500).json({ error: 'Failed to queue social scraping job' });
  }
};

/**
 * POST /api/data-collection/social/scrape/pending
 * Trigger scraping for all businesses that have websites but no social links yet.
 */
export const scrapePendingBusinesses = async (req: Request, res: Response): Promise<void> => {
  try {
    const businesses = await findBusinessesWithoutSocialLinks();

    if (businesses.length === 0) {
      res.json({
        message: 'No businesses pending social scraping',
        count: 0,
      });
      return;
    }

    const scrapeJobs = businesses.map((b) => ({
      googleRawBusinessId: b.id,
      businessName: b.name,
      websiteUrl: b.uri!,
      requestedBy: req.ip ?? 'unknown',
    }));

    const jobs = await addBulkScrapeJobs(scrapeJobs);

    logger.info(
      { count: jobs.length, ip: req.ip },
      'Bulk social scraping jobs queued for pending businesses'
    );

    res.status(202).json({
      message: `${jobs.length} social scraping jobs queued`,
      count: jobs.length,
      status: 'queued',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue pending social scraping jobs');
    res.status(500).json({ error: 'Failed to queue social scraping jobs' });
  }
};

/**
 * POST /api/data-collection/social/scrape/all
 * Re-scrape social links for ALL businesses with a website URL.
 * Upserts social links — existing links are updated, not duplicated.
 */
export const scrapeAllBusinesses = async (req: Request, res: Response): Promise<void> => {
  try {
    const businesses = await getAllGoogleRawBusinesses(0, 10000);

    const scrapeJobs = businesses
      .filter((b) => b.uri)
      .map((b) => ({
        googleRawBusinessId: b.id,
        businessName: b.name,
        websiteUrl: b.uri!,
        requestedBy: req.ip ?? 'unknown',
      }));

    if (scrapeJobs.length === 0) {
      res.json({ message: 'No businesses with websites to scrape', count: 0 });
      return;
    }

    const jobs = await addBulkScrapeJobs(scrapeJobs);

    logger.info({ count: jobs.length, ip: req.ip }, 'Queued social scraping for all businesses');

    res.status(202).json({
      message: `${jobs.length} social scraping jobs queued`,
      count: jobs.length,
      status: 'queued',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue social scraping for all businesses');
    res.status(500).json({ error: 'Failed to queue social scraping jobs' });
  }
};

/**
 * GET /api/data-collection/social/links/:businessId
 * Get social links for a specific business.
 */
export const getBusinessSocialLinks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.params;

    if (!businessId) {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    const socialLinks = await findSocialLinksByBusinessId(businessId);

    if (!socialLinks) {
      res.status(404).json({ error: 'No social links found for this business' });
      return;
    }

    res.json(socialLinks);
  } catch (error) {
    logger.error({ error, businessId: req.params.businessId }, 'Failed to fetch social links');
    res.status(500).json({ error: 'Failed to fetch social links' });
  }
};

/**
 * GET /api/data-collection/social/stats
 * Get scraping statistics.
 */
export const getSocialScrapingStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getSocialLinkStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch social scraping stats');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

/**
 * GET /api/data-collection/social/queue/stats
 * Get social scraper queue statistics.
 */
export const getSocialQueueStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getSocialScraperQueueStats();

    res.json({
      queue: 'social-scraper',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch social scraper queue stats');
    res.status(500).json({ error: 'Failed to fetch queue statistics' });
  }
};
