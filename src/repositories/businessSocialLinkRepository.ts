import prisma from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Upsert a business social link record.
 * Creates if new, updates if already scraped (keyed by googleRawBusinessId).
 */
export const upsertBusinessSocialLink = async (
  data: {
    googleRawBusinessId: string;
    websiteUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    twitterUrl: string | null;
    scrapedAt: Date;
    scrapeMethod: string;
    scrapeStatus: string;
    errorMessage: string | null | undefined;
    rawLinksFound: unknown;
  },
  createdBy: string = 'system'
) => {
  try {
    const now = new Date();
    const rawLinks = (data.rawLinksFound ?? Prisma.JsonNull) as Prisma.InputJsonValue;

    const result = await prisma.businessSocialLink.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        websiteUrl: data.websiteUrl,
        facebookUrl: data.facebookUrl,
        instagramUrl: data.instagramUrl,
        twitterUrl: data.twitterUrl,
        scrapedAt: data.scrapedAt,
        scrapeMethod: data.scrapeMethod,
        scrapeStatus: data.scrapeStatus,
        errorMessage: data.errorMessage ?? null,
        rawLinksFound: rawLinks,
        createdOn: now,
        createdBy,
        updatedOn: now,
        updatedBy: createdBy,
      },
      update: {
        websiteUrl: data.websiteUrl,
        facebookUrl: data.facebookUrl,
        instagramUrl: data.instagramUrl,
        twitterUrl: data.twitterUrl,
        scrapedAt: data.scrapedAt,
        scrapeMethod: data.scrapeMethod,
        scrapeStatus: data.scrapeStatus,
        errorMessage: data.errorMessage ?? null,
        rawLinksFound: rawLinks,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, status: data.scrapeStatus },
      'Upserted business social link'
    );

    return result;
  } catch (error) {
    logger.error(
      { error, businessId: data.googleRawBusinessId },
      'Failed to upsert business social link'
    );
    throw error;
  }
};

/**
 * Find businesses that have a website URL but no social link record yet.
 */
export const findBusinessesWithoutSocialLinks = async (limit: number = 1000) => {
  try {
    return await prisma.googleRawBusiness.findMany({
      where: {
        uri: { not: null },
        socialLinks: null,
      },
      take: limit,
      orderBy: { createdOn: 'desc' },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to find businesses without social links');
    throw error;
  }
};

/**
 * Find social links for a specific business by its GoogleRawBusiness ID.
 */
export const findSocialLinksByBusinessId = async (googleRawBusinessId: string) => {
  try {
    return await prisma.businessSocialLink.findUnique({
      where: { googleRawBusinessId },
    });
  } catch (error) {
    logger.error({ error, googleRawBusinessId }, 'Failed to find social links by business ID');
    throw error;
  }
};

/**
 * Get social link scraping statistics grouped by status.
 */
export const getSocialLinkStats = async () => {
  try {
    const stats = await prisma.businessSocialLink.groupBy({
      by: ['scrapeStatus'],
      _count: { _all: true },
    });

    const total = await prisma.businessSocialLink.count();
    const withFacebook = await prisma.businessSocialLink.count({
      where: { facebookUrl: { not: null } },
    });
    const withInstagram = await prisma.businessSocialLink.count({
      where: { instagramUrl: { not: null } },
    });
    const withTwitter = await prisma.businessSocialLink.count({
      where: { twitterUrl: { not: null } },
    });

    return {
      total,
      byStatus: stats.map((s) => ({
        status: s.scrapeStatus,
        count: s._count._all,
      })),
      withFacebook,
      withInstagram,
      withTwitter,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get social link stats');
    throw error;
  }
};
