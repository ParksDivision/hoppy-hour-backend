import prisma from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import type { DealSourceType, ExtractedDeal } from '../services/dealAnalyzer/types';

/**
 * Upsert aggregated pending deals for a business (1 row per business).
 * Replaces any existing unpublished row; leaves published rows untouched.
 */
export const upsertPendingDeals = async (
  data: {
    googleRawBusinessId: string;
    businessName: string | null;
    primarySource: DealSourceType;
    deals: ExtractedDeal[];
  },
  createdBy: string = 'system'
) => {
  try {
    const now = new Date();
    const deals = (data.deals.length > 0 ? data.deals : Prisma.JsonNull) as unknown as Prisma.InputJsonValue;

    const result = await prisma.pendingDealAustin.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        businessName: data.businessName,
        primarySource: data.primarySource,
        deals,
        published: false,
        createdOn: now,
        createdBy,
        updatedOn: now,
        updatedBy: createdBy,
      },
      update: {
        businessName: data.businessName,
        primarySource: data.primarySource,
        deals,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, dealCount: data.deals.length },
      'Upserted pending deals'
    );

    return result;
  } catch (error) {
    logger.error({ error, businessId: data.googleRawBusinessId }, 'Failed to upsert pending deals');
    throw error;
  }
};

/**
 * Set a pending deal row as published or unpublished.
 */
export const setPublished = async (
  googleRawBusinessId: string,
  published: boolean,
  publishedBy: string
) => {
  try {
    const now = new Date();

    const result = await prisma.pendingDealAustin.update({
      where: { googleRawBusinessId },
      data: {
        published,
        publishedAt: published ? now : null,
        publishedBy: published ? publishedBy : null,
        updatedOn: now,
        updatedBy: publishedBy,
      },
    });

    logger.debug(
      { businessId: googleRawBusinessId, published },
      'Updated pending deal publish status'
    );

    return result;
  } catch (error) {
    logger.error({ error, googleRawBusinessId }, 'Failed to set publish status');
    throw error;
  }
};

/**
 * Find pending deals with optional filters.
 */
export const findPendingDeals = async (options?: {
  published?: boolean;
  limit?: number;
  offset?: number;
}) => {
  try {
    return await prisma.pendingDealAustin.findMany({
      where: options?.published !== undefined ? { published: options.published } : {},
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
      orderBy: { updatedOn: 'desc' },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to find pending deals');
    throw error;
  }
};

/**
 * Find a single pending deal by business ID.
 */
export const findPendingDealByBusinessId = async (googleRawBusinessId: string) => {
  try {
    return await prisma.pendingDealAustin.findUnique({
      where: { googleRawBusinessId },
    });
  } catch (error) {
    logger.error({ error, googleRawBusinessId }, 'Failed to find pending deal');
    throw error;
  }
};
