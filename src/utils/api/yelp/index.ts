// src/services/yelp/index.ts
import prisma from '../../../prismaClient';
import { logger } from '../../../lib/logger';
import { searchBusinesses, fetchBusinessDetails, type YelpBusiness } from './api';
import { AUSTIN_LOCATIONS } from '../google/enums'; // Reuse the same locations

const processYelpData = (business: YelpBusiness) => ({
  placeId: `yelp_${business.id}`,
  name: business.name,
  address: `${business.location.address1}, ${business.location.city}, ${business.location.state} ${business.location.zip_code}`,
  latitude: business.coordinates.latitude,
  longitude: business.coordinates.longitude,
  rating: business.rating || null,
  priceLevel: business.price ? business.price.length : null,
  website: business.url || null,
  phoneNumber: business.phone || null,
  isBar: business.categories.some(cat => 
    ['bars', 'pubs', 'breweries'].includes(cat.alias)
  ),
  isRestaurant: business.categories.some(cat => 
    ['restaurants', 'food'].includes(cat.alias)
  ),
  openingHours: business.hours?.[0]?.open.map(hour => 
    `${hour.day}: ${hour.start}-${hour.end}`
  ) || [],
  lastUpdated: new Date(),
  source: 'YELP' as const,
});

const updateYelpBusinessesForLocation = async (location: { lat: number; lng: number; name: string }) => {
  try {
    logger.info(`Fetching Yelp businesses for ${location.name}`);
    const businesses = await searchBusinesses(location);
    
    for (const business of businesses) {
      try {
        const details = await fetchBusinessDetails(business.id);
        const processedData = processYelpData(details);
        
        await prisma.business.upsert({
          where: { placeId: processedData.placeId },
          update: processedData,
          create: processedData,
        });
      } catch (error) {
        logger.error(`Failed to process Yelp business ${business.id}:`, error);
        continue;
      }
    }
    
    logger.info(`Completed Yelp update for ${location.name}`);
  } catch (error) {
    logger.error(`Failed to update Yelp businesses for ${location.name}:`, error);
    throw error;
  }
};

export const updateYelpData = async () => {
  try {
    logger.info('Starting Yelp data update for all locations');
    
    for (const location of AUSTIN_LOCATIONS) {
      await updateYelpBusinessesForLocation(location);
    }
    
    logger.info('Completed Yelp data update for all locations');
  } catch (error) {
    logger.error('Failed to update Yelp data:', error);
    throw error;
  }
};