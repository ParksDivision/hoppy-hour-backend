import { findDealsByBusinessId } from '../../repositories/rawDealAnalysisRepository';
import { upsertPendingDeals, setPublished } from '../../repositories/pendingDealAustinRepository';
import { upsertProductionDeal, removeProductionDeal } from '../../repositories/productionDealAustinRepository';
import { findGoogleRawBusinessById } from '../../repositories/googleRawBusinessRepository';
import { findSocialLinksByBusinessId } from '../../repositories/businessSocialLinkRepository';
import { aggregateBusinessDeals } from '../dealAnalyzer/dealAggregator';
import { logger } from '../../utils/logger';

/**
 * Count how many source types have URLs configured for a business.
 * Used to determine when all sources have been analyzed.
 */
async function countExpectedSources(googleRawBusinessId: string): Promise<number> {
  const links = await findSocialLinksByBusinessId(googleRawBusinessId);
  let count = 0;
  if (links?.websiteUrl) count++;
  if (links?.instagramUrl) count++;
  if (links?.facebookUrl) count++;
  if (links?.twitterUrl) count++;
  return Math.max(count, 1); // at least 1 (website via business URI)
}

/**
 * Aggregate raw analysis results and stage them as pending deals.
 * Only runs Layer 2 (Claude comparison) when ALL expected sources have been analyzed.
 * This prevents redundant Claude calls when sources complete one at a time.
 */
export async function aggregateAndStagePendingDeals(
  googleRawBusinessId: string,
  createdBy: string = 'system'
): Promise<void> {
  const rawRows = await findDealsByBusinessId(googleRawBusinessId);

  if (rawRows.length === 0) {
    logger.debug({ businessId: googleRawBusinessId }, 'No raw analysis rows found, skipping staging');
    return;
  }

  // Wait until all expected sources have been analyzed (success, error, or no_deals all count)
  const expectedSources = await countExpectedSources(googleRawBusinessId);
  if (rawRows.length < expectedSources) {
    logger.debug(
      { businessId: googleRawBusinessId, analyzed: rawRows.length, expected: expectedSources },
      'Not all sources analyzed yet, deferring aggregation'
    );
    return;
  }

  // Filter to only successful rows for aggregation — error/failed rows should not be compared
  const successfulRows = rawRows.filter((r) => r.analysisStatus === 'success');

  const aggregated = await aggregateBusinessDeals(googleRawBusinessId, successfulRows);

  if (aggregated.deals.length === 0) {
    logger.debug({ businessId: googleRawBusinessId }, 'No deals after aggregation, skipping staging');
    return;
  }

  const business = await findGoogleRawBusinessById(googleRawBusinessId);

  await upsertPendingDeals(
    {
      googleRawBusinessId,
      businessName: business?.name ?? null,
      primarySource: aggregated.primarySource,
      deals: aggregated.deals,
    },
    createdBy
  );

  logger.info(
    { businessId: googleRawBusinessId, dealCount: aggregated.deals.length, source: aggregated.primarySource },
    'Staged pending deals for business'
  );
}

/**
 * Publish a pending deal to production.
 * Sets published=true on pending row and copies to production table.
 */
export async function publishDeal(
  googleRawBusinessId: string,
  publishedBy: string
): Promise<void> {
  const pending = await setPublished(googleRawBusinessId, true, publishedBy);

  await upsertProductionDeal({
    googleRawBusinessId: pending.googleRawBusinessId,
    businessName: pending.businessName,
    primarySource: pending.primarySource,
    deals: pending.deals,
    publishedAt: pending.publishedAt,
    publishedBy: pending.publishedBy,
  });

  logger.info({ businessId: googleRawBusinessId, publishedBy }, 'Published deal to production');
}

/**
 * Unpublish a deal — remove from production and mark pending as unpublished.
 */
export async function unpublishDeal(
  googleRawBusinessId: string,
  publishedBy: string
): Promise<void> {
  await setPublished(googleRawBusinessId, false, publishedBy);
  await removeProductionDeal(googleRawBusinessId);

  logger.info({ businessId: googleRawBusinessId, publishedBy }, 'Unpublished deal from production');
}
