import prisma from '../utils/database';
import { logger } from '../utils/logger';

/**
 * Find all businesses with published production deals, joined with
 * business details, social links, and Google Places data.
 */
export const findProductionBusinessesWithDeals = async (options?: {
  limit?: number;
  offset?: number;
}) => {
  try {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const rows = await prisma.productionDealAustin.findMany({
      include: {
        googleRawBusiness: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
            addressFull: true,
            location: true,
            primaryPhone: true,
            uri: true,
            data: true,
            socialLinks: {
              select: {
                websiteUrl: true,
                facebookUrl: true,
                instagramUrl: true,
                twitterUrl: true,
              },
            },
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { publishedAt: 'desc' },
    });

    return rows;
  } catch (error) {
    logger.error({ error }, 'Failed to find production businesses with deals');
    throw error;
  }
};

/**
 * Count total businesses with production deals.
 */
export const countProductionBusinesses = async () => {
  try {
    return await prisma.productionDealAustin.count();
  } catch (error) {
    logger.error({ error }, 'Failed to count production businesses');
    throw error;
  }
};
