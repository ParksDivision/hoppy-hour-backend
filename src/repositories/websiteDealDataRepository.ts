import prisma from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import type { DealSourceType } from '../services/dealAnalyzer/types';

/**
 * Upsert a website deal data record.
 * Creates if new, updates if already analyzed (keyed by googleRawBusinessId + sourceType).
 */
export const upsertWebsiteDealData = async (
  data: {
    googleRawBusinessId: string;
    sourceType: DealSourceType;
    sourceUrl: string | null;
    deals: unknown;
    rawAiResponse: unknown;
    aiModel: string;
    aiPromptVersion: string;
    analysisStatus: string;
    errorMessage: string | null | undefined;
    analyzedAt: Date;
  },
  createdBy: string = 'system'
) => {
  try {
    const now = new Date();
    const deals = (data.deals ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    const rawAiResponse = (data.rawAiResponse ?? Prisma.JsonNull) as Prisma.InputJsonValue;

    const result = await prisma.websiteDealData.upsert({
      where: {
        googleRawBusinessId_sourceType: {
          googleRawBusinessId: data.googleRawBusinessId,
          sourceType: data.sourceType,
        },
      },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl,
        deals,
        rawAiResponse,
        aiModel: data.aiModel,
        aiPromptVersion: data.aiPromptVersion,
        analysisStatus: data.analysisStatus,
        errorMessage: data.errorMessage ?? null,
        analyzedAt: data.analyzedAt,
        createdOn: now,
        createdBy,
        updatedOn: now,
        updatedBy: createdBy,
      },
      update: {
        sourceUrl: data.sourceUrl,
        deals,
        rawAiResponse,
        aiModel: data.aiModel,
        aiPromptVersion: data.aiPromptVersion,
        analysisStatus: data.analysisStatus,
        errorMessage: data.errorMessage ?? null,
        analyzedAt: data.analyzedAt,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      {
        businessId: data.googleRawBusinessId,
        sourceType: data.sourceType,
        status: data.analysisStatus,
      },
      'Upserted website deal data'
    );

    return result;
  } catch (error) {
    logger.error(
      { error, businessId: data.googleRawBusinessId },
      'Failed to upsert website deal data'
    );
    throw error;
  }
};

/**
 * Map sourceType to the corresponding URL field on BusinessSocialLink.
 */
const SOURCE_URL_FIELD: Record<DealSourceType, string> = {
  website: 'websiteUrl',
  instagram: 'instagramUrl',
  facebook: 'facebookUrl',
  twitter: 'twitterUrl',
};

/**
 * Find businesses that have been scraped for social links but not yet analyzed for deals.
 * Dynamically checks the URL field that corresponds to the sourceType.
 */
export const findBusinessesWithoutDealAnalysis = async (
  sourceType: DealSourceType = 'website',
  limit: number = 1000
) => {
  try {
    const urlField = SOURCE_URL_FIELD[sourceType];

    return await prisma.businessSocialLink.findMany({
      where: {
        [urlField]: { not: null },
        scrapeStatus: 'success',
        googleRawBusiness: {
          dealData: {
            none: {
              sourceType,
            },
          },
        },
      },
      include: {
        googleRawBusiness: {
          select: { id: true, name: true, uri: true },
        },
      },
      take: limit,
      orderBy: { createdOn: 'desc' },
    });
  } catch (error) {
    logger.error({ error, sourceType }, 'Failed to find businesses without deal analysis');
    throw error;
  }
};

/**
 * Find deal data for a specific business (all source types).
 */
export const findDealsByBusinessId = async (googleRawBusinessId: string) => {
  try {
    return await prisma.websiteDealData.findMany({
      where: { googleRawBusinessId },
    });
  } catch (error) {
    logger.error({ error, googleRawBusinessId }, 'Failed to find deals by business ID');
    throw error;
  }
};

/**
 * Get deal analysis statistics grouped by status.
 */
export const getDealAnalysisStats = async () => {
  try {
    const stats = await prisma.websiteDealData.groupBy({
      by: ['analysisStatus'],
      _count: { _all: true },
    });

    const total = await prisma.websiteDealData.count();
    const withDeals = await prisma.websiteDealData.count({
      where: {
        analysisStatus: 'success',
      },
    });

    return {
      total,
      withDeals,
      byStatus: stats.map((s) => ({
        status: s.analysisStatus,
        count: s._count._all,
      })),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get deal analysis stats');
    throw error;
  }
};
