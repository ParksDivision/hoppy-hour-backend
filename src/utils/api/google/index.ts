// src/utils/api/google/index.ts
import { v4 as uuidv4 } from 'uuid';
import { publishEvent } from '../../../events/eventBus';
import { googlePlacesLogger as logger } from '../../../utils/logger/logger';
import { 
  fetchNearbyBusinesses,
  type Location,
} from './api';
import { processPlaceData } from './utilities';
import { cloudflareS3Service } from '../../../utils/cloudflareS3Service';
import axios from 'axios';

// Enhanced photo processing with cost control (kept for future use)
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

// UPDATED: Event-driven version that publishes events instead of direct DB operations
export const updateBusinessesForLocation = async (location: Location) => {
  const logContext = { location: location.name };
  
  try {
    logger.info(logContext, 'Starting Google Places update via event system');
    
    // Get cost report before starting
    const costReport = await cloudflareS3Service.getCostReport();
    logger.info('Pre-update cost status', {
      location: location.name,
      currentSpent: costReport.currentMonth.total,
      remainingBudget: costReport.remainingBudget,
      emergencyMode: costReport.emergencyMode
    });
    
    const businesses = await fetchNearbyBusinesses(location);
    logger.info({ ...logContext, count: businesses.length }, 'Retrieved businesses');
    
    let publishedCount = 0;
    let errorCount = 0;

    // Explicitly type business as any or the correct type if known
    for (const business of businesses as any[]) {
      try {
        // Create raw collected event
        const rawEvent = {
          id: uuidv4(),
          timestamp: new Date(),
          source: 'google-places-api',
          type: 'business.raw.collected' as const,
          data: {
            sourceId: business.id,
            source: 'GOOGLE' as const,
            rawData: business,
            location
          }
        };

        // Publish to event system (will trigger standardization -> deduplication)
        publishEvent(rawEvent);
        publishedCount++;
        
        logger.debug({
          businessId: business.id,
          businessName: business.displayName?.text || 'Unknown'
        }, 'Published raw business event');

      } catch (error) {
        errorCount++;
        logger.error({
          err: error,
          businessId: business.id,
          businessName: business.displayName?.text || 'Unknown'
        }, 'Failed to publish business event');
      }
    }

    // Get final cost report
    const finalCostReport = await cloudflareS3Service.getCostReport();
    
    logger.info('Completed Google Places update via events', {
      ...logContext,
      totalFetched: businesses.length,
      publishedCount,
      errorCount,
      costInfo: {
        initialCost: costReport.currentMonth.total,
        finalCost: finalCostReport.currentMonth.total,
        remainingBudget: finalCostReport.remainingBudget,
        emergencyMode: finalCostReport.emergencyMode
      }
    });
    
  } catch (error) {
    logger.error({ err: error, ...logContext }, 'Failed Google Places update');
    throw error;
  }
};