import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { logger } from '../utils/logger/logger';
import type { 
  BusinessSearchCriteria, 
  BusinessWithRelations, 
  StandardizedBusiness 
} from '../types/business';

/**
 * Find a business by ID with optional relations
 */
export const findBusinessById = async (
  id: string,
  includeRelations: boolean = true
): Promise<BusinessWithRelations | null> => {
  try {
    const business = await prisma.business.findUnique({
      where: { id },
      include: includeRelations ? {
        photos: {
          orderBy: { mainPhoto: 'desc' }
        },
        deals: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' }
        },
        sourceBusinesses: true
      } : undefined
    });

    return business as BusinessWithRelations | null;
  } catch (error) {
    logger.error({ err: error, businessId: id }, 'Failed to find business by ID');
    throw error;
  }
};

/**
 * Find a business by source ID and source type
 */
export const findBusinessBySourceId = async (
  sourceId: string,
  source: string
): Promise<BusinessWithRelations | null> => {
  try {
    const business = await prisma.business.findFirst({
      where: {
        sourceBusinesses: {
          some: {
            sourceId,
            source
          }
        }
      },
      include: {
        photos: {
          orderBy: { mainPhoto: 'desc' }
        },
        deals: {
          where: { isActive: true }
        },
        sourceBusinesses: true
      }
    });

    return business as BusinessWithRelations | null;
  } catch (error) {
    logger.error({ 
      err: error, 
      sourceId, 
      source 
    }, 'Failed to find business by source ID');
    throw error;
  }
};

/**
 * Search businesses based on criteria
 */
export const searchBusinesses = async (
  criteria: BusinessSearchCriteria
): Promise<BusinessWithRelations[]> => {
  try {
    const where: Prisma.BusinessWhereInput = {};

    // Name search
    if (criteria.name) {
      where.OR = [
        { name: { contains: criteria.name, mode: 'insensitive' } },
        { normalizedName: { contains: criteria.name.toLowerCase(), mode: 'insensitive' } }
      ];
    }

    // Type filters
    if (criteria.isBar !== undefined) {
      where.isBar = criteria.isBar;
    }
    if (criteria.isRestaurant !== undefined) {
      where.isRestaurant = criteria.isRestaurant;
    }

    // Rating filters
    if (criteria.minRating !== undefined) {
      where.ratingOverall = { gte: criteria.minRating };
    }
    if (criteria.maxRating !== undefined) {
      where.ratingOverall = { 
        ...(where.ratingOverall as object || {}), 
        lte: criteria.maxRating 
      };
    }

    // Price level filters
    if (criteria.minPriceLevel !== undefined) {
      where.priceLevel = { gte: criteria.minPriceLevel };
    }
    if (criteria.maxPriceLevel !== undefined) {
      where.priceLevel = { 
        ...(where.priceLevel as object || {}), 
        lte: criteria.maxPriceLevel 
      };
    }

    // Categories filter
    if (criteria.categories && criteria.categories.length > 0) {
      where.categories = {
        hasSome: criteria.categories
      };
    }

    const businesses = await prisma.business.findMany({
      where,
      include: {
        photos: {
          orderBy: { mainPhoto: 'desc' },
          take: 1
        },
        deals: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' }
        }
      },
      orderBy: [
        { ratingOverall: 'desc' },
        { name: 'asc' }
      ],
      take: criteria.limit || 50,
      skip: criteria.offset || 0
    });

    // Apply location filtering if specified
    if (criteria.latitude && criteria.longitude && criteria.radiusKm) {
      return filterByLocation(
        businesses as BusinessWithRelations[],
        criteria.latitude,
        criteria.longitude,
        criteria.radiusKm
      );
    }

    return businesses as BusinessWithRelations[];
  } catch (error) {
    logger.error({ err: error, criteria }, 'Failed to search businesses');
    throw error;
  }
};

/**
 * Find potential duplicate businesses
 */
export const findPotentialDuplicates = async (
  standardizedBusiness: StandardizedBusiness
): Promise<BusinessWithRelations[]> => {
  try {
    // Search for businesses with similar names and nearby location
    const candidates = await prisma.business.findMany({
      where: {
        AND: [
          // Name similarity (using PostgreSQL similarity if available, otherwise contains)
          {
            OR: [
              { normalizedName: { contains: standardizedBusiness.normalizedName.substring(0, 10) } },
              { name: { contains: standardizedBusiness.name.substring(0, 10), mode: 'insensitive' } }
            ]
          },
          // Location proximity (rough bounding box)
          {
            latitude: {
              gte: standardizedBusiness.latitude - 0.01, // ~1km
              lte: standardizedBusiness.latitude + 0.01
            }
          },
          {
            longitude: {
              gte: standardizedBusiness.longitude - 0.01,
              lte: standardizedBusiness.longitude + 0.01
            }
          }
        ]
      },
      include: {
        photos: true,
        deals: true,
        sourceBusinesses: true
      }
    });

    return candidates as BusinessWithRelations[];
  } catch (error) {
    logger.error({ 
      err: error, 
      businessName: standardizedBusiness.name 
    }, 'Failed to find potential duplicates');
    throw error;
  }
};

/**
 * Create a new business
 */
export const createBusiness = async (
  standardizedBusiness: StandardizedBusiness
): Promise<BusinessWithRelations> => {
  try {
    const business = await prisma.business.create({
      data: {
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
        sourceBusinesses: {
          create: {
            source: standardizedBusiness.source,
            sourceId: standardizedBusiness.sourceId,
            rawData: {}, // Would need to pass raw data if needed
            lastFetched: new Date()
          }
        }
      },
      include: {
        photos: true,
        deals: true,
        sourceBusinesses: true
      }
    });

    logger.info({ 
      businessId: business.id, 
      name: business.name 
    }, 'Created new business');

    return business as BusinessWithRelations;
  } catch (error) {
    logger.error({ 
      err: error, 
      businessName: standardizedBusiness.name 
    }, 'Failed to create business');
    throw error;
  }
};

/**
 * Update an existing business
 */
export const updateBusiness = async (
  businessId: string,
  standardizedBusiness: StandardizedBusiness,
  confidence: number
): Promise<BusinessWithRelations> => {
  try {
    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        name: standardizedBusiness.name,
        normalizedName: standardizedBusiness.normalizedName,
        address: standardizedBusiness.address,
        normalizedAddress: standardizedBusiness.normalizedAddress,
        latitude: standardizedBusiness.latitude,
        longitude: standardizedBusiness.longitude,
        phone: standardizedBusiness.phone || undefined,
        normalizedPhone: standardizedBusiness.normalizedPhone || undefined,
        website: standardizedBusiness.website || undefined,
        domain: standardizedBusiness.domain || undefined,
        isBar: standardizedBusiness.isBar,
        isRestaurant: standardizedBusiness.isRestaurant,
        categories: standardizedBusiness.categories,
        ratingGoogle: standardizedBusiness.ratingGoogle || undefined,
        ratingYelp: standardizedBusiness.ratingYelp || undefined,
        ratingOverall: standardizedBusiness.ratingOverall || undefined,
        priceLevel: standardizedBusiness.priceLevel || undefined,
        operatingHours: standardizedBusiness.operatingHours,
        confidence,
        lastAnalyzed: new Date(),
        sourceBusinesses: {
          upsert: {
            where: {
              source_sourceId: {
                source: standardizedBusiness.source,
                sourceId: standardizedBusiness.sourceId
              }
            },
            create: {
              source: standardizedBusiness.source,
              sourceId: standardizedBusiness.sourceId,
              rawData: {},
              lastFetched: new Date()
            },
            update: {
              rawData: {},
              lastFetched: new Date()
            }
          }
        }
      },
      include: {
        photos: true,
        deals: true,
        sourceBusinesses: true
      }
    });

    logger.info({ 
      businessId, 
      name: business.name,
      confidence 
    }, 'Updated business');

    return business as BusinessWithRelations;
  } catch (error) {
    logger.error({ 
      err: error, 
      businessId,
      businessName: standardizedBusiness.name 
    }, 'Failed to update business');
    throw error;
  }
};

/**
 * Merge business data
 */
export const mergeBusiness = async (
  targetBusinessId: string,
  standardizedBusiness: StandardizedBusiness,
  confidence: number
): Promise<BusinessWithRelations> => {
  try {
    // Get existing business
    const existingBusiness = await findBusinessById(targetBusinessId, true);
    if (!existingBusiness) {
      throw new Error(`Target business not found: ${targetBusinessId}`);
    }

    // Merge data intelligently
    const mergedData = {
      name: standardizedBusiness.name, // Use new name
      normalizedName: standardizedBusiness.normalizedName,
      address: standardizedBusiness.address, // Use new address
      normalizedAddress: standardizedBusiness.normalizedAddress,
      latitude: standardizedBusiness.latitude,
      longitude: standardizedBusiness.longitude,
      phone: standardizedBusiness.phone || existingBusiness.phone,
      normalizedPhone: standardizedBusiness.normalizedPhone || existingBusiness.normalizedPhone,
      website: standardizedBusiness.website || existingBusiness.website,
      domain: standardizedBusiness.domain || existingBusiness.domain,
      isBar: standardizedBusiness.isBar || existingBusiness.isBar,
      isRestaurant: standardizedBusiness.isRestaurant || existingBusiness.isRestaurant,
      categories: Array.from(new Set([...existingBusiness.categories, ...standardizedBusiness.categories])),
      ratingGoogle: standardizedBusiness.ratingGoogle || existingBusiness.ratingGoogle,
      ratingYelp: standardizedBusiness.ratingYelp || existingBusiness.ratingYelp,
      ratingOverall: standardizedBusiness.ratingOverall || existingBusiness.ratingOverall,
      priceLevel: standardizedBusiness.priceLevel || existingBusiness.priceLevel,
      operatingHours: standardizedBusiness.operatingHours.length > 0 ? standardizedBusiness.operatingHours : existingBusiness.operatingHours,
      confidence,
      lastAnalyzed: new Date()
    };

    const business = await prisma.business.update({
      where: { id: targetBusinessId },
      data: {
        ...mergedData,
        sourceBusinesses: {
          upsert: {
            where: {
              source_sourceId: {
                source: standardizedBusiness.source,
                sourceId: standardizedBusiness.sourceId
              }
            },
            create: {
              source: standardizedBusiness.source,
              sourceId: standardizedBusiness.sourceId,
              rawData: {},
              lastFetched: new Date()
            },
            update: {
              rawData: {},
              lastFetched: new Date()
            }
          }
        }
      },
      include: {
        photos: true,
        deals: true,
        sourceBusinesses: true
      }
    });

    logger.info({ 
      businessId: targetBusinessId,
      name: business.name,
      confidence,
      mergedCategories: business.categories.length
    }, 'Merged business data');

    return business as BusinessWithRelations;
  } catch (error) {
    logger.error({ 
      err: error, 
      targetBusinessId,
      businessName: standardizedBusiness.name 
    }, 'Failed to merge business');
    throw error;
  }
};

/**
 * Helper function to filter businesses by location
 */
const filterByLocation = (
  businesses: BusinessWithRelations[],
  latitude: number,
  longitude: number,
  radiusKm: number
): BusinessWithRelations[] => {
  return businesses.filter(business => {
    const distance = calculateDistance(
      latitude, longitude,
      business.latitude, business.longitude
    );
    return distance <= radiusKm;
  });
};

/**
 * Calculate distance between two points using Haversine formula
 */
const calculateDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};