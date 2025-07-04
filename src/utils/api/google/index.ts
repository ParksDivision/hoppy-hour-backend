/* -------------------------IMPORTS------------------------- */
import prisma from '../../../prismaClient';
import { googlePlacesLogger as logger } from '../../../utils/logger/logger';
import { 
  fetchNearbyBusinesses,
  type Location,
} from './api';
import { processPlaceData } from './utilities';
import { uploadImageWithVariants } from '../../../utils/enhancedS3Service';
import axios from 'axios';

/* -------------------------FUNCTIONS------------------------- */
async function processAndUploadPhoto(photo: any, businessId: string) {
  try {
    // Construct the correct Google Places photo URL
    const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?key=${process.env.GOOGLE_PLACES_API_KEY}&maxHeightPx=1200&maxWidthPx=1200`;

    // Download image with proper headers
    const imageResponse = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': '*',
        'Accept': 'image/*'
      },
      maxRedirects: 5,
      timeout: 10000
    });

    // Verify we got an image
    const contentType = imageResponse.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      console.error('Invalid response:', {
        contentType,
        responseLength: imageResponse.data.length,
        photoUrl
      });
      throw new Error(`Invalid content type: ${contentType}`);
    }

    // Process and upload to S3
    const processedImages = await uploadImageWithVariants(
      Buffer.from(imageResponse.data),
      businessId,
      photo.name.replace(/[^a-zA-Z0-9-_]/g, '_') // Sanitize the photo name
    );

    return {
      sourceId: photo.name,
      source: 'GOOGLE',
      width: photo.widthPx,
      height: photo.heightPx,
      url: photoUrl, // Store the actual photo URL we used
      s3Key: processedImages.original,
      s3KeyThumbnail: processedImages.thumbnail,
      s3KeySmall: processedImages.small,
      s3KeyMedium: processedImages.medium,
      s3KeyLarge: processedImages.large,
      mainPhoto: false
    };
  } catch (error) {
    logger.error(
      { 
        err: error, 
        businessId, 
        photoName: photo.name,
        photoUrl: photo.googleMapsUri 
      },
      'Failed to process and upload photo'
    );
    
    // Don't throw the error, return null instead to allow other photos to process
    return null;
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
        )
      );

      // Filter out null results from failed photos
      const validPhotos = processedPhotos.filter(photo => photo !== null)
        .map((photo, index) => ({
          ...photo,
          mainPhoto: index === 0
        }));

      if (validPhotos.length > 0) {
        // Create all photos in the database
        await tx.photo.createMany({
          data: validPhotos.map(photo => ({
            ...photo,
            businessId: upsertedBusiness.id,
            createdOn: new Date(),
            lastFetched: new Date()
          }))
        });
      }
    } catch (error) {
      logger.error(
        { err: error, businessId: upsertedBusiness.id },
        'Failed to process photos'
      );
    // Continue with other businesses even if photos fail
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