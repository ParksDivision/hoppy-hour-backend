import { Business, Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import type { StandardizedBusiness } from '../types/business';

export interface BusinessSearchCriteria {
  name?: string;
  normalizedName?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  phone?: string;
  domain?: string;
  limit?: number;
}

// Calculate overall rating from multiple sources
const calculateOverallRating = (googleRating?: number, yelpRating?: number): number | undefined => {
  const ratings = [googleRating, yelpRating].filter(r => r !== undefined && r !== null) as number[];
  
  if (ratings.length === 0) return undefined;
  
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
};

// Create business data object
const createBusinessDataFromStandardized = (standardizedBusiness: StandardizedBusiness): Prisma.BusinessCreateInput => ({
  placeId: standardizedBusiness.source === 'GOOGLE' ? standardizedBusiness.sourceId : undefined,
  yelpId: standardizedBusiness.source === 'YELP' ? standardizedBusiness.sourceId : undefined,
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
  confidence: 1.0, // New business has full confidence
  createdOn: new Date(),
  updatedOn: new Date()
});

// Create update data object
const createUpdateDataFromStandardized = (
  standardizedBusiness: StandardizedBusiness, 
  confidence: number
): Prisma.BusinessUpdateInput => ({
  // Update source IDs if they don't exist
  placeId: standardizedBusiness.source === 'GOOGLE' ? standardizedBusiness.sourceId : undefined,
  yelpId: standardizedBusiness.source === 'YELP' ? standardizedBusiness.sourceId : undefined,
  
  // Always update core data
  name: standardizedBusiness.name,
  normalizedName: standardizedBusiness.normalizedName,
  address: standardizedBusiness.address,
  normalizedAddress: standardizedBusiness.normalizedAddress,
  latitude: standardizedBusiness.latitude,
  longitude: standardizedBusiness.longitude,
  
  // Update contact info if provided
  phone: standardizedBusiness.phone || undefined,
  normalizedPhone: standardizedBusiness.normalizedPhone || undefined,
  website: standardizedBusiness.website || undefined,
  domain: standardizedBusiness.domain || undefined,
  
  // Update classification
  isBar: standardizedBusiness.isBar,
  isRestaurant: standardizedBusiness.isRestaurant,
  categories: standardizedBusiness.categories,
  
  // Update ratings based on source
  ratingGoogle: standardizedBusiness.source === 'GOOGLE' ? standardizedBusiness.ratingGoogle : undefined,
  ratingYelp: standardizedBusiness.source === 'YELP' ? standardizedBusiness.ratingYelp : undefined,
  ratingOverall: standardizedBusiness.ratingOverall,
  priceLevel: standardizedBusiness.priceLevel,
  operatingHours: standardizedBusiness.operatingHours,
  
  confidence,
  updatedOn: new Date(),
  lastAnalyzed: new Date()
});

// Pure function to create merged data object
const createMergedDataFromStandardized = (
  currentBusiness: Business,
  standardizedBusiness: StandardizedBusiness,
  confidence: number
): Prisma.BusinessUpdateInput => ({
  // Add source IDs if they don't exist
  placeId: currentBusiness.placeId || (standardizedBusiness.source === 'GOOGLE' ? standardizedBusiness.sourceId : undefined),
  yelpId: currentBusiness.yelpId || (standardizedBusiness.source === 'YELP' ? standardizedBusiness.sourceId : undefined),
  
  // Keep existing name if it's longer/more complete, otherwise use new one
  name: currentBusiness.name.length > standardizedBusiness.name.length ? currentBusiness.name : standardizedBusiness.name,
  
  // Always update location data if new data has higher confidence
  latitude: standardizedBusiness.latitude,
  longitude: standardizedBusiness.longitude,
  address: standardizedBusiness.address,
  normalizedAddress: standardizedBusiness.normalizedAddress,
  
  // Merge contact info (prefer existing if available)
  phone: currentBusiness.phone || standardizedBusiness.phone,
  normalizedPhone: currentBusiness.normalizedPhone || standardizedBusiness.normalizedPhone,
  website: currentBusiness.website || standardizedBusiness.website,
  domain: currentBusiness.domain || standardizedBusiness.domain,
  
  // Union of categories
  categories: Array.from(new Set(currentBusiness.categories.concat(standardizedBusiness.categories))),
  
  // Update ratings based on source
  ratingGoogle: standardizedBusiness.source === 'GOOGLE' ? standardizedBusiness.ratingGoogle : currentBusiness.ratingGoogle,
  ratingYelp: standardizedBusiness.source === 'YELP' ? standardizedBusiness.ratingYelp : currentBusiness.ratingYelp,
  
  // Recalculate overall rating
  ratingOverall: calculateOverallRating(
    standardizedBusiness.source === 'GOOGLE'
      ? (standardizedBusiness.ratingGoogle ?? undefined)
      : (currentBusiness.ratingGoogle ?? undefined),
    standardizedBusiness.source === 'YELP'
      ? (standardizedBusiness.ratingYelp ?? undefined)
      : (currentBusiness.ratingYelp ?? undefined)
  ),
  
  priceLevel: standardizedBusiness.priceLevel || currentBusiness.priceLevel,
  operatingHours: standardizedBusiness.operatingHours.length > 0 ? standardizedBusiness.operatingHours : currentBusiness.operatingHours,
  
  confidence,
  updatedOn: new Date(),
  lastAnalyzed: new Date()
});

// Pure function to create geographic bounding box
const createGeographicBounds = (latitude: number, longitude: number, radiusKm: number = 0.5) => {
  const latDelta = radiusKm / 111; // Rough conversion: 1 degree lat ≈ 111 km
  const lngDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));
  
  return {
    latMin: latitude - latDelta,
    latMax: latitude + latDelta,
    lngMin: longitude - lngDelta,
    lngMax: longitude + lngDelta
  };
};

// Database operation functions
export const createBusiness = async (standardizedBusiness: StandardizedBusiness): Promise<Business> => {
  const businessData = createBusinessDataFromStandardized(standardizedBusiness);
  
  return await prisma.business.create({
    data: businessData
  });
};

export const updateBusiness = async (
  businessId: string, 
  standardizedBusiness: StandardizedBusiness, 
  confidence: number
): Promise<Business> => {
  const updateData = createUpdateDataFromStandardized(standardizedBusiness, confidence);

  return await prisma.business.update({
    where: { id: businessId },
    data: updateData
  });
};

export const mergeBusiness = async (
  targetBusinessId: string, 
  standardizedBusiness: StandardizedBusiness, 
  confidence: number
): Promise<Business> => {
  // Get current business data
  const currentBusiness = await findBusinessById(targetBusinessId);
  if (!currentBusiness) {
    throw new Error(`Business not found: ${targetBusinessId}`);
  }

  // Merge the data intelligently
  const mergedData = createMergedDataFromStandardized(currentBusiness, standardizedBusiness, confidence);

  return await prisma.business.update({
    where: { id: targetBusinessId },
    data: mergedData
  });
};

export const findPotentialDuplicates = async (standardizedBusiness: StandardizedBusiness): Promise<Business[]> => {
  const bounds = createGeographicBounds(standardizedBusiness.latitude, standardizedBusiness.longitude);
  
  const candidates = await prisma.business.findMany({
    where: {
      AND: [
        // Geographic bounding box
        { latitude: { gte: bounds.latMin } },
        { latitude: { lte: bounds.latMax } },
        { longitude: { gte: bounds.lngMin } },
        { longitude: { lte: bounds.lngMax } },
        
        // Optional name similarity (basic filter)
        {
          OR: [
            { normalizedName: { contains: standardizedBusiness.normalizedName.split(' ')[0] } },
            { normalizedPhone: standardizedBusiness.normalizedPhone || undefined },
            { domain: standardizedBusiness.domain || undefined }
          ]
        }
      ]
    },
    take: 20 // Limit candidates for performance
  });

  return candidates;
};

export const findBusinessById = async (id: string): Promise<Business | null> => {
  return await prisma.business.findUnique({
    where: { id }
  });
};

export const findBusinessBySourceId = async (sourceId: string, source: string): Promise<Business | null> => {
  const where = source === 'GOOGLE' 
    ? { placeId: sourceId }
    : source === 'YELP'
    ? { yelpId: sourceId }
    : { id: sourceId }; // fallback

  return await prisma.business.findFirst({ where });
};

export const searchBusinesses = async (criteria: BusinessSearchCriteria): Promise<Business[]> => {
  const where: Prisma.BusinessWhereInput = {};

  if (criteria.name) {
    where.name = { contains: criteria.name, mode: 'insensitive' };
  }

  if (criteria.normalizedName) {
    where.normalizedName = { contains: criteria.normalizedName };
  }

  if (criteria.phone) {
    where.normalizedPhone = criteria.phone;
  }

  if (criteria.domain) {
    where.domain = criteria.domain;
  }

  if (criteria.latitude && criteria.longitude && criteria.radiusKm) {
    const bounds = createGeographicBounds(criteria.latitude, criteria.longitude, criteria.radiusKm);
    
    where.AND = [
      { latitude: { gte: bounds.latMin } },
      { latitude: { lte: bounds.latMax } },
      { longitude: { gte: bounds.lngMin } },
      { longitude: { lte: bounds.lngMax } }
    ];
  }

  return await prisma.business.findMany({
    where,
    take: criteria.limit || 50,
    orderBy: { updatedOn: 'desc' }
  });
};

// Export utility functions for testing
export {
  calculateOverallRating,
  createBusinessDataFromStandardized,
  createUpdateDataFromStandardized,
  createMergedDataFromStandardized,
  createGeographicBounds
};