import prisma from '../prismaClient';
import type { StandardizedBusiness } from '../types/business';
import { logger } from '../utils/logger/logger';
import type { BusinessWithRelations } from '../types/business';
import type { Business, Photo, Deal, SourceBusiness } from '@prisma/client';

// Helper type for search parameters
interface BusinessSearchParams {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
  offset?: number;
  includePhotos?: boolean;
  includeDeals?: boolean;
}

type BusinessWithAllRelations = Business & {
  photos: Photo[];
  deals: Deal[];
  sourceBusinesses: SourceBusiness[];
};

// Get business by ID with related data
export const findBusinessById = async (id: string) => {
  try {
    return await prisma.business.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { mainPhoto: 'desc' }
        },
        deals: {
          where: { isActive: true },
          orderBy: { startTime: 'asc' }
        },
        sourceBusinesses: true
      }
    });
  } catch (error) {
    logger.error({ err: error, businessId: id }, 'Failed to find business by ID');
    throw error;
  }
};

// Find business by source ID and source type
export const findBusinessBySourceId = async (sourceId: string, source: string) => {
  try {
    const sourceBusiness = await prisma.sourceBusiness.findUnique({
      where: {
        source_sourceId: {
          source,
          sourceId
        }
      },
      include: {
        business: {
          include: {
            photos: true,
            deals: { where: { isActive: true } }
          }
        }
      }
    });
    
    return sourceBusiness?.business || null;
  } catch (error) {
    logger.error({ err: error, sourceId, source }, 'Failed to find business by source ID');
    throw error;
  }
};

// Search businesses with optional filters
export const searchBusinesses = async (
  params: BusinessSearchParams = {}
): Promise<any[]> => {
  try {
    const {
      latitude,
      longitude,
      radiusKm = 10,
      limit = 50,
      offset = 0,
      includePhotos = true,
      includeDeals = true
    } = params;

    // Base query configuration
    const queryConfig: any = {
      include: {
        ...(includePhotos && {
          photos: {
            orderBy: { mainPhoto: 'desc' },
            take: 5
          }
        }),
        ...(includeDeals && {
          deals: {
            where: { isActive: true },
            orderBy: { startTime: 'asc' }
          }
        })
      },
      orderBy: [
        { ratingOverall: 'desc' },
        { name: 'asc' }
      ],
      take: limit,
      skip: offset
    };

    // Add location-based filtering if coordinates provided
    if (latitude && longitude) {
      // Using raw SQL for distance calculation (Haversine formula)
      const businesses = await prisma.$queryRaw`
        SELECT b.*, 
               (6371 * acos(cos(radians(${latitude})) * cos(radians(b.latitude)) 
               * cos(radians(b.longitude) - radians(${longitude})) 
               + sin(radians(${latitude})) * sin(radians(b.latitude)))) AS distance
        FROM businesses b
        WHERE (6371 * acos(cos(radians(${latitude})) * cos(radians(b.latitude)) 
               * cos(radians(b.longitude) - radians(${longitude})) 
               + sin(radians(${latitude})) * sin(radians(b.latitude)))) <= ${radiusKm}
        ORDER BY distance, b.rating_overall DESC, b.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      // If we need related data, fetch it separately for each business
      if (includePhotos || includeDeals) {
        const businessIds = (businesses as any[]).map(b => b.id);
        
        const enrichedBusinesses = await Promise.all(
          businessIds.map(id => findBusinessById(id))
        );
        
        return enrichedBusinesses.filter(Boolean);
      }

      return businesses as any[];
    }

    // Regular search without location filtering
    return await prisma.business.findMany(queryConfig);

  } catch (error) {
    logger.error({ err: error, params }, 'Failed to search businesses');
    throw error;
  }
};

// Find potential duplicates for deduplication
export const findPotentialDuplicates = async (business: StandardizedBusiness) => {
  try {
    // Search for businesses with similar names or locations
    const candidates = await prisma.business.findMany({
      where: {
        OR: [
          // Similar normalized names
          {
            normalizedName: {
              contains: business.normalizedName,
              mode: 'insensitive'
            }
          },
          // Same phone number
          ...(business.normalizedPhone ? [{
            normalizedPhone: business.normalizedPhone
          }] : []),
          // Same domain
          ...(business.domain ? [{
            domain: business.domain
          }] : []),
          // Nearby location (rough proximity check)
          {
            AND: [
              {
                latitude: {
                  gte: business.latitude - 0.001, // ~100m radius
                  lte: business.latitude + 0.001
                }
              },
              {
                longitude: {
                  gte: business.longitude - 0.001,
                  lte: business.longitude + 0.001
                }
              }
            ]
          }
        ]
      },
      include: {
        sourceBusinesses: true,
        photos: true,
        deals: { where: { isActive: true } }
      }
    });

    return candidates;
  } catch (error) {
    logger.error({ err: error, businessName: business.name }, 'Failed to find potential duplicates');
    throw error;
  }
};

// Create new business with source tracking
export const createBusiness = async (standardizedBusiness: StandardizedBusiness) => {
  try {
    const businessData = {
      id: undefined, // Let Prisma generate
      name: standardizedBusiness.name,
      normalizedName: standardizedBusiness.normalizedName,
      address: standardizedBusiness.address,
      normalizedAddress: standardizedBusiness.normalizedAddress,
      latitude: standardizedBusiness.latitude,
      longitude: standardizedBusiness.longitude,
      phone: standardizedBusiness.phone,
      normalizedPhone: standardizedBusiness.normalizedPhone,
      website: standardizedBusiness.website,
      domain: standardizedBusiness.domain,
      isBar: standardizedBusiness.isBar,
      isRestaurant: standardizedBusiness.isRestaurant,
      categories: standardizedBusiness.categories,
      ratingGoogle: standardizedBusiness.ratingGoogle,
      ratingYelp: standardizedBusiness.ratingYelp,
      ratingOverall: standardizedBusiness.ratingOverall,
      priceLevel: standardizedBusiness.priceLevel,
      operatingHours: standardizedBusiness.operatingHours,
      confidence: 1.0,
      createdOn: new Date(),
      updatedOn: new Date()
    };

    // Create business and source record in transaction
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: businessData
      });

      // Create source tracking record
      await tx.sourceBusiness.create({
        data: {
          businessId: business.id,
          source: standardizedBusiness.source,
          sourceId: standardizedBusiness.sourceId,
          rawData: {}, // Will be populated later if needed
          lastFetched: new Date(),
          createdOn: new Date()
        }
      });

      return business;
    });

    logger.info({
      businessId: result.id,
      name: result.name,
      source: standardizedBusiness.source,
      sourceId: standardizedBusiness.sourceId
    }, 'Created new business');

    return result;
  } catch (error) {
    logger.error({ err: error, businessName: standardizedBusiness.name }, 'Failed to create business');
    throw error;
  }
};

// Update existing business
export const updateBusiness = async (
  businessId: string,
  standardizedBusiness: StandardizedBusiness,
  confidence: number
) => {
  try {
    const updateData = {
      // Update fields that might have new information
      ...(standardizedBusiness.phone && { phone: standardizedBusiness.phone }),
      ...(standardizedBusiness.normalizedPhone && { normalizedPhone: standardizedBusiness.normalizedPhone }),
      ...(standardizedBusiness.website && { website: standardizedBusiness.website }),
      ...(standardizedBusiness.domain && { domain: standardizedBusiness.domain }),
      ...(standardizedBusiness.ratingGoogle && { ratingGoogle: standardizedBusiness.ratingGoogle }),
      ...(standardizedBusiness.ratingYelp && { ratingYelp: standardizedBusiness.ratingYelp }),
      ...(standardizedBusiness.ratingOverall && { ratingOverall: standardizedBusiness.ratingOverall }),
      ...(standardizedBusiness.priceLevel && { priceLevel: standardizedBusiness.priceLevel }),
      ...(standardizedBusiness.operatingHours.length > 0 && { operatingHours: standardizedBusiness.operatingHours }),
      categories: [...new Set([...standardizedBusiness.categories])], // Merge categories
      confidence,
      updatedOn: new Date()
    };

    const result = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
      include: {
        photos: true,
        deals: { where: { isActive: true } }
      }
    });

    logger.info({
      businessId,
      name: result.name,
      confidence,
      source: standardizedBusiness.source
    }, 'Updated business');

    return result;
  } catch (error) {
    logger.error({ err: error, businessId }, 'Failed to update business');
    throw error;
  }
};

// Merge businesses (for high-confidence duplicates)
export const mergeBusiness = async (
  targetBusinessId: string,
  standardizedBusiness: StandardizedBusiness,
  confidence: number
) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update the target business with new information
      const updatedBusiness = await tx.business.update({
        where: { id: targetBusinessId },
        data: {
          // Merge data intelligently
          phone: standardizedBusiness.phone || undefined,
          normalizedPhone: standardizedBusiness.normalizedPhone || undefined,
          website: standardizedBusiness.website || undefined,
          domain: standardizedBusiness.domain || undefined,
          ratingGoogle: standardizedBusiness.ratingGoogle || undefined,
          ratingYelp: standardizedBusiness.ratingYelp || undefined,
          ratingOverall: standardizedBusiness.ratingOverall || undefined,
          priceLevel: standardizedBusiness.priceLevel || undefined,
          operatingHours: standardizedBusiness.operatingHours.length > 0 ? standardizedBusiness.operatingHours : undefined,
          confidence,
          updatedOn: new Date()
        },
        include: {
          photos: true,
          deals: { where: { isActive: true } }
        }
      });

      // Add source tracking for the new source
      await tx.sourceBusiness.upsert({
        where: {
          source_sourceId: {
            source: standardizedBusiness.source,
            sourceId: standardizedBusiness.sourceId
          }
        },
        update: {
          businessId: targetBusinessId,
          lastFetched: new Date(),
          updatedOn: new Date()
        },
        create: {
          businessId: targetBusinessId,
          source: standardizedBusiness.source,
          sourceId: standardizedBusiness.sourceId,
          rawData: {},
          lastFetched: new Date(),
          createdOn: new Date()
        }
      });

      return updatedBusiness;
    });

    logger.info({
      targetBusinessId,
      name: result.name,
      confidence,
      source: standardizedBusiness.source,
      sourceId: standardizedBusiness.sourceId
    }, 'Merged business');

    return result;
  } catch (error) {
    logger.error({ err: error, targetBusinessId }, 'Failed to merge business');
    throw error;
  }
};

// Get businesses count for statistics
export const getBusinessCount = async (filters?: any) => {
  try {
    return await prisma.business.count({
      where: filters
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get business count');
    throw error;
  }
};

// Get businesses with photos count
export const getBusinessesWithPhotosCount = async () => {
  try {
    return await prisma.business.count({
      where: {
        photos: {
          some: {}
        }
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get businesses with photos count');
    throw error;
  }
};

// Get businesses with deals count
export const getBusinessesWithDealsCount = async () => {
  try {
    return await prisma.business.count({
      where: {
        deals: {
          some: { isActive: true }
        }
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get businesses with deals count');
    throw error;
  }
};