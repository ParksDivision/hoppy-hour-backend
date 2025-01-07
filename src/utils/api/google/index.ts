/* -------------------------IMPORTS------------------------- */
import prisma from '../../../prismaClient';
import { googlePlacesLogger as logger } from '../../../lib/logger';
import { 
  fetchNearbyBusinesses, 
  fetchPlaceDetails,
  type Location,
  type PlaceDetails,
  GooglePlacesError
} from './api';
import { AUSTIN_LOCATIONS } from './enums';


/* -------------------------UTILITIES------------------------- */
const processPlaceData = (place: PlaceDetails) => ({
  placeId: place.place_id,
  name: place.name,
  address: place.formatted_address,
  latitude: place.geometry.location.lat,
  longitude: place.geometry.location.lng,
  rating: place.rating || null,
  priceLevel: place.price_level || null,
  website: place.website || null,
  phoneNumber: place.formatted_phone_number || null,
  isBar: place.types.includes('bar'),
  isRestaurant: place.types.includes('restaurant'),
  openingHours: place.opening_hours?.weekday_text || [],
  lastUpdated: new Date(),
  source: 'GOOGLE' as const,
});

/* -------------------------FUNCTIONS------------------------- */
const updateBusinessesForLocation = async (location: Location) => {
  const logContext = { location: location.name };
  
  try {
    logger.info(logContext, 'Starting Google Places update for location');
    
    const businesses = await fetchNearbyBusinesses(location);
    logger.info({ ...logContext, count: businesses.length }, 'Retrieved businesses');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const business of businesses) {
      try {
        const details = await fetchPlaceDetails(business.place_id);
        const processedData = processPlaceData(details);
        
        await prisma.business.upsert({
          where: { placeId: business.place_id },
          update: processedData,
          create: processedData,
        });
        
        successCount++;
        
        logger.debug(
          { ...logContext, businessId: business.place_id, name: details.name },
          'Successfully processed business'
        );
      } catch (error) {
        errorCount++;
        logger.error(
          { err: error, ...logContext, businessId: business.place_id },
          'Failed to process business'
        );
        continue; // Skip this business but continue with others
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

export const updateGooglePlacesData = async () => {
  const startTime = Date.now();
  logger.info('Starting Google Places data update for all locations');
  
  try {
    // Process locations sequentially to respect API rate limits
    for (const location of AUSTIN_LOCATIONS) {
      await updateBusinessesForLocation(location);
    }
    
    const duration = Date.now() - startTime;
    logger.info(
      { duration, locationCount: AUSTIN_LOCATIONS.length },
      'Completed Google Places data update for all locations'
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      { err: error, duration },
      'Failed to complete Google Places data update'
    );
    throw error;
  }
};