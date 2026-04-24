import prisma from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Upsert a production deal row from a published pending deal.
 * Keyed on googleRawBusinessId (1 row per business).
 */
export const upsertProductionDeal = async (pendingDeal: {
  googleRawBusinessId: string;
  businessName: string | null;
  primarySource: string | null;
  deals: unknown;
  publishedAt: Date | null;
  publishedBy: string | null;
}) => {
  try {
    const now = new Date();
    const deals = (pendingDeal.deals ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue;

    const result = await prisma.productionDealAustin.upsert({
      where: { googleRawBusinessId: pendingDeal.googleRawBusinessId },
      create: {
        googleRawBusinessId: pendingDeal.googleRawBusinessId,
        businessName: pendingDeal.businessName,
        primarySource: pendingDeal.primarySource,
        deals,
        publishedAt: pendingDeal.publishedAt ?? now,
        publishedBy: pendingDeal.publishedBy,
        createdOn: now,
        createdBy: pendingDeal.publishedBy ?? 'system',
        updatedOn: now,
        updatedBy: pendingDeal.publishedBy ?? 'system',
      },
      update: {
        businessName: pendingDeal.businessName,
        primarySource: pendingDeal.primarySource,
        deals,
        publishedAt: pendingDeal.publishedAt ?? now,
        publishedBy: pendingDeal.publishedBy,
        updatedOn: now,
        updatedBy: pendingDeal.publishedBy ?? 'system',
      },
    });

    logger.debug(
      { businessId: pendingDeal.googleRawBusinessId },
      'Upserted production deal'
    );

    return result;
  } catch (error) {
    logger.error({ error, businessId: pendingDeal.googleRawBusinessId }, 'Failed to upsert production deal');
    throw error;
  }
};

/**
 * Remove a production deal (when unpublishing).
 */
export const removeProductionDeal = async (googleRawBusinessId: string) => {
  try {
    await prisma.productionDealAustin.deleteMany({
      where: { googleRawBusinessId },
    });

    logger.debug({ businessId: googleRawBusinessId }, 'Removed production deal');
  } catch (error) {
    logger.error({ error, googleRawBusinessId }, 'Failed to remove production deal');
    throw error;
  }
};

/**
 * Find all production deals (for frontend).
 */
export const findProductionDeals = async (options?: {
  limit?: number;
  offset?: number;
}) => {
  try {
    return await prisma.productionDealAustin.findMany({
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
      orderBy: { publishedAt: 'desc' },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to find production deals');
    throw error;
  }
};

/**
 * Find production deals for a specific business.
 */
export const findProductionDealByBusinessId = async (googleRawBusinessId: string) => {
  try {
    return await prisma.productionDealAustin.findUnique({
      where: { googleRawBusinessId },
    });
  } catch (error) {
    logger.error({ error, googleRawBusinessId }, 'Failed to find production deal');
    throw error;
  }
};
