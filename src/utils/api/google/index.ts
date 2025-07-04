import prisma from '../../../prismaClient';
import { googlePlacesLogger as logger } from '../../../utils/logger/logger';
import { 
  fetchNearbyBusinesses,
  type Location,
} from './api';
import { processPlaceData } from './utilities';
import { cloudflareS3Service } from '../../../utils/cloudflareS3Service'; // Updated import
import axios from 'axios';

// Enhanced photo processing with cost control
async function processAndUploadPhoto(photo: any, businessId: string) {
  try {
    // Construct the correct Google Places photo URL
    const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?key=${process.env.GOOGLE_PLACES_API_KEY}&maxHeightPx=1200&maxWidthPx=1200`;

    logger.debug('Processing photo', {
      businessId,
      photoName: photo.name,
      photoUrl
    });

    // Download image with proper headers and timeout
    const imageResponse = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': '*',
        'Accept': 'image/*'
      },
      maxRedirects: 5,
      timeout: 15000 // 15 second timeout
    });

    // Verify we got an image
    const contentType = imageResponse.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const imageBuffer = Buffer.from(imageResponse.data);
    
    // Validate image size (max 10MB)
    if (imageBuffer.length > 10 * 1024 * 1024) {
      logger.warn('Image too large, skipping', {
        businessId,
        photoName: photo.name,
        size: imageBuffer.length
      });
      return null;
    }

    // Use the new Cloudflare S3 service with cost control
    const sanitizedPhotoName = photo.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    try {
      // Upload multiple variants with cost control
      const uploadedVariants = await cloudflareS3Service.uploadImageWithVariants(
        imageBuffer,
        businessId,
        sanitizedPhotoName
      );

      logger.info('Photo uploaded successfully', {
        businessId,
        photoName: photo.name,
        variants: Object.keys(uploadedVariants),
        originalSize: imageBuffer.length
      });

      return {
        sourceId: photo.name,
        source: 'GOOGLE',
        width: photo.widthPx,
        height: photo.heightPx,
        url: photoUrl,
        s3Key: uploadedVariants.original || null,
        s3KeyThumbnail: uploadedVariants.thumbnail || null,
        s3KeySmall: uploadedVariants.small || null,
        s3KeyMedium: uploadedVariants.medium || null,
        s3KeyLarge: uploadedVariants.large || null,
        mainPhoto: false,
        format: 'jpeg',
        fileSize: imageBuffer.length,
        lastProcessed: new Date()
      };

    } catch (uploadError) {
      // If upload fails due to cost controls, log and continue
      if (uploadError instanceof Error && uploadError.message.includes('blocked')) {
        logger.warn('Photo upload blocked by cost controls', {
          businessId,
          photoName: photo.name,
          reason: uploadError.message
        });
        
        // Return photo record without S3 keys (will use external URL)
        return {
          sourceId: photo.name,
          source: 'GOOGLE',
          width: photo.widthPx,
          height: photo.heightPx,
          url: photoUrl,
          s3Key: null,
          s3KeyThumbnail: null,
          s3KeySmall: null,
          s3KeyMedium: null,
          s3KeyLarge: null,
          mainPhoto: false
        };
      }
      throw uploadError;
    }

  } catch (error) {
    logger.error('Failed to process and upload photo', { 
      error, 
      businessId, 
      photoName: photo.name,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    
    // Return null to skip this photo but continue with others
    return null;
  }
}

export const updateBusinessesForLocation = async (location: Location) => {
  const logContext = { location: location.name };
  
  try {
    logger.info(logContext, 'Starting Google Places update for location');
    
    // Get cost report before starting
    const costReport = await cloudflareS3Service.getCostReport();
    logger.info('Pre-update cost status', {
      location: location.name,
      currentSpent: costReport.currentMonth.total,
      remainingBudget: costReport.remainingBudget,
      emergencyMode: costReport.emergencyMode
    });

    // If in emergency mode, skip photo processing
    if (costReport.emergencyMode) {
      logger.warn('Emergency mode active - skipping photo processing', logContext);
    }
    
    const businesses = await fetchNearbyBusinesses(location);
    logger.info({ ...logContext, count: businesses.length }, 'Retrieved businesses');
    
    let successCount = 0;
    let errorCount = 0;
    let photoProcessingSkipped = 0;
    
    for (let index = 0; index < businesses.length; index++) {
      const business = businesses[index];
      try {
        await prisma.$transaction(async (tx) => {
          // Process and upsert business info
          const businessData = processPlaceData(business);
          const upsertedBusiness = await tx.business.upsert({
            where: { placeId: business.id },
            create: { ...businessData, createdOn: new Date() },
            update: { ...businessData, updatedOn: new Date() }
          });

          // Process photos if they exist and we're not in emergency mode
          if (business.photos?.length && !costReport.emergencyMode) {
            try {
              // Limit photos per business to control costs (max 3 photos)
              const photosToProcess = business.photos.slice(0, 3);
              
              logger.debug('Processing photos for business', {
                businessId: upsertedBusiness.id,
                businessName: business.name || business.displayName?.text,
                totalPhotos: business.photos.length,
                processingPhotos: photosToProcess.length
              });

              // Process photos sequentially to respect rate limits
              const processedPhotos: any[] = [];
              
              for (let photoIndex = 0; photoIndex < photosToProcess.length; photoIndex++) {
                const photo = photosToProcess[photoIndex];
                try {
                  const processedPhoto = await processAndUploadPhoto(photo, upsertedBusiness.id);
                  
                  if (processedPhoto) {
                    processedPhotos.push({
                      ...processedPhoto,
                      mainPhoto: photoIndex === 0 // First photo is main photo
                    });
                  }

                  // Small delay between photos to be gentle on rate limits
                  if (photoIndex < photosToProcess.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                  }
                  
                } catch (photoError) {
                  logger.error('Failed to process individual photo', {
                    error: photoError,
                    businessId: upsertedBusiness.id,
                    photoIndex
                  });
                  // Continue with next photo
                }
              }

              // Create photo records in database
              if (processedPhotos.length > 0) {
                await tx.photo.createMany({
                  data: processedPhotos.map(photo => ({
                    ...photo,
                    businessId: upsertedBusiness.id,
                    createdOn: new Date(),
                    lastFetched: new Date()
                  })),
                  skipDuplicates: true
                });

                logger.debug('Photos saved to database', {
                  businessId: upsertedBusiness.id,
                  savedPhotos: processedPhotos.length
                });
              }

            } catch (photoError) {
              logger.error('Failed to process photos for business', {
                error: photoError,
                businessId: upsertedBusiness.id,
                businessName: business.name || business.displayName?.text
              });
              // Continue with other businesses even if photos fail
            }
          } else if (business.photos?.length) {
            photoProcessingSkipped++;
            logger.debug('Photo processing skipped', {
              businessId: upsertedBusiness.id,
              reason: costReport.emergencyMode ? 'emergency_mode' : 'no_photos',
              photoCount: business.photos.length
            });
          }
        });
 
        successCount++;
        
        // Log progress every 10 businesses
        if ((index + 1) % 10 === 0) {
          logger.debug('Progress update', {
            ...logContext,
            processed: index + 1,
            total: businesses.length,
            successCount,
            errorCount
          });
        }

      } catch (error) {
        errorCount++;
        logger.error('Failed to process business', {
          error,
          ...logContext,
          businessId: business.id,
          businessName: business.name || business.displayName?.text
        });
        continue;
      }
    }

    // Get final cost report
    const finalCostReport = await cloudflareS3Service.getCostReport();
    
    logger.info('Completed location update', {
      ...logContext,
      successCount,
      errorCount,
      totalCount: businesses.length,
      photoProcessingSkipped,
      costInfo: {
        initialCost: costReport.currentMonth.total,
        finalCost: finalCostReport.currentMonth.total,
        costIncrease: finalCostReport.currentMonth.total - costReport.currentMonth.total,
        remainingBudget: finalCostReport.remainingBudget,
        emergencyMode: finalCostReport.emergencyMode
      }
    });

    // Warn if emergency mode was triggered during processing
    if (!costReport.emergencyMode && finalCostReport.emergencyMode) {
      logger.warn('Emergency mode triggered during location update', {
        location: location.name,
        finalCost: finalCostReport.currentMonth.total
      });
    }

  } catch (error) {
    logger.error('Failed to update location', {
      err: error,
      ...logContext
    });
    throw error;
  }
};