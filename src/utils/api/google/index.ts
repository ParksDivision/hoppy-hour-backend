/* -------------------------IMPORTS------------------------- */
import prisma from '../../../prismaClient';
import { googlePlacesLogger as logger } from '../../../lib/logger';
import { 
  fetchNearbyBusinesses,
  type Location,
  type PlaceDetails,
  GooglePlacesError
} from './api';
import { processPlaceData } from './utilities';
import { AUSTIN_LOCATIONS } from './enums';
import { Photo } from '@prisma/client';
import { OptimizedS3Service } from '../../../utils/enhancedS3Service';
import axios from 'axios';

/* -------------------------FUNCTIONS------------------------- */
async function processAndUploadPhoto(photo: any, businessId: string) {
  try {
    // Download image from Google Places
    const imageResponse = await axios.get(photo.googleMapsUri, {
      responseType: 'arraybuffer'
    });
    
    // Process and upload all variants to S3
    const processedImages = await OptimizedS3Service.uploadImageWithVariants(
      Buffer.from(imageResponse.data),
      businessId,
      photo.name
    );

    return {
      sourceId: photo.name,
      source: 'GOOGLE',
      width: photo.widthPx,
      height: photo.heightPx,
      url: photo.googleMapsUri,
      s3Key: processedImages.original,
      s3KeyThumbnail: processedImages.thumbnail,
      s3KeySmall: processedImages.small,
      s3KeyMedium: processedImages.medium,
      s3KeyLarge: processedImages.large,
      mainPhoto: false // Will be set by the calling function
    };
  } catch (error) {
    logger.error(
      { err: error, businessId, photoName: photo.name },
      'Failed to process and upload photo'
    );
    throw error;
  }
}

export const updateBusinessesForLocation = async (location: Location) => {
  const logContext = { location: location.name };
  
  try {
    logger.info(logContext, 'Starting Google Places update for location');
    
    const businesses = await fetchNearbyBusinesses(location);
    logger.info({ ...logContext, count: businesses.length }, 'Retrieved businesses');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const business of businesses) {
      try {
        await prisma.$transaction(async (tx) => {
          // Process and upsert business info
          const businessData = processPlaceData(business);
          const upsertedBusiness = await tx.business.upsert({
            where: { placeId: business.id },
            create: { ...businessData, createdOn: new Date() },
            update: { ...businessData, updatedOn: new Date() }
          });

          // Process photos if they exist
          if (business.photos?.length) {
            try {
              // Process all photos in parallel
              const processedPhotos = await Promise.all(
                business.photos.map((photo: any, index: number) => 
                  processAndUploadPhoto(photo, upsertedBusiness.id)
                    .then(photoData => ({
                      ...photoData,
                      mainPhoto: index === 0
                    }))
                )
              );

              // Create all photos in the database
              await tx.photo.createMany({
                data: processedPhotos.map(photo => ({
                  ...photo,
                  businessId: upsertedBusiness.id,
                  createdOn: new Date(),
                  lastFetched: new Date()
                }))
              });

            } catch (error) {
              logger.error(
                { err: error, businessId: upsertedBusiness.id },
                'Failed to process photos'
              );
              throw error;
            }
          }
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