// src/services/yelp/index.ts
import prisma from '../../../prismaClient';
import { yelpLogger as logger } from '../../../lib/logger';
import { searchBusinesses, fetchBusinessDetails, type YelpBusiness } from './api';
import { AUSTIN_LOCATIONS } from '../google/index';

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
  const logContext = { location: location.name };
  
  try {
    logger.info(logContext, 'Starting Yelp update for location');
    
    const businesses = await searchBusinesses(location);
    logger.info({ ...logContext, count: businesses.length }, 'Retrieved businesses');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const business of businesses) {
      try {
        const details = await fetchBusinessDetails(business.id);
        const processedData = processYelpData(details);
        
        await prisma.businesses.upsert({
          where: { placeId: processedData.placeId },
          update: processedData,
          create: processedData,
        });
        
        successCount++;
        
        logger.debug(
          { ...logContext, businessId: business.id, name: business.name },
          'Successfully processed business'
        );
      } catch (error) {
        errorCount++;
        logger.error(
          { err: error, ...logContext, businessId: business.id },
          'Failed to process business'
        );
        continue;
      }
    }
    
    logger.info(
      { ...logContext, successCount, errorCount, totalCount: businesses.length },
      'Completed location update'
    );
  } catch (error) {
    logger.error(
      { err: error, ...logContext },
      'Failed to update location'
    );
    throw error;
  }
};

export const updateYelpData = async () => {
  const startTime = Date.now();
  logger.info('Starting Yelp data update for all locations');
  
  try {
    for (const location of AUSTIN_LOCATIONS) {
      await updateYelpBusinessesForLocation(location);
    }
    
    const duration = Date.now() - startTime;
    logger.info(
      { duration, locationCount: AUSTIN_LOCATIONS.length },
      'Completed Yelp data update for all locations'
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      { err: error, duration },
      'Failed to complete Yelp data update'
    );
    throw error;
  }
};