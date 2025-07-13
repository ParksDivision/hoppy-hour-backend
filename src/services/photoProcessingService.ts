import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import prisma from '../prismaClient';
import { logger } from '../utils/logger/logger';
import { subscribeToEvent, publishEvent } from '../events/eventBus';
import { cloudflareS3Service } from '../utils/cloudflareS3Service';
import type { BusinessDeduplicatedEvent, PhotoProcessedEvent } from '../events/eventTypes';

// Configuration
const PHOTO_CONFIG = {
  maxPhotosPerBusiness: 10, // FIXED: Updated to 10 as requested
  maxImageSize: 10 * 1024 * 1024, // 10MB
  downloadTimeout: 15000, // 15 seconds
  delayBetweenPhotos: 500, // 500ms between photo downloads
};

// Pure function to construct Google Places photo URL
const buildGooglePhotoUrl = (photoName: string, maxSize: number = 1200): string => {
  const baseUrl = 'https://places.googleapis.com/v1';
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  return `${baseUrl}/${photoName}/media?key=${apiKey}&maxHeightPx=${maxSize}&maxWidthPx=${maxSize}`;
};

// Pure function to sanitize photo names for S3
const sanitizePhotoName = (photoName: string): string => {
  return photoName.replace(/[^a-zA-Z0-9-_]/g, '_');
};

// Download image from Google Places API
const downloadGooglePhoto = async (photoName: string): Promise<Buffer | null> => {
  try {
    const photoUrl = buildGooglePhotoUrl(photoName);
    
    logger.debug({ photoName, photoUrl }, 'Downloading photo from Google Places');

    const response = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'Accept': 'image/*'
      },
      timeout: PHOTO_CONFIG.downloadTimeout,
      maxRedirects: 5
    });

    // Verify content type
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      logger.warn({ photoName, contentType }, 'Invalid content type for photo');
      return null;
    }

    const imageBuffer = Buffer.from(response.data);
    
    // Check size limits
    if (imageBuffer.length > PHOTO_CONFIG.maxImageSize) {
      logger.warn({ 
        photoName, 
        size: imageBuffer.length, 
        maxSize: PHOTO_CONFIG.maxImageSize 
      }, 'Photo too large, skipping');
      return null;
    }

    logger.debug({ 
      photoName, 
      size: imageBuffer.length,
      contentType 
    }, 'Successfully downloaded photo');

    return imageBuffer;

  } catch (error) {
    logger.error({ 
      err: error, 
      photoName,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown'
    }, 'Failed to download photo');
    return null;
  }
};

// Process and upload photo variants
const processAndUploadPhoto = async (
  imageBuffer: Buffer,
  businessId: string,
  photoId: string,
  isMainPhoto: boolean = false
): Promise<any | null> => {
  try {
    // Upload multiple variants with cost control
    const uploadedVariants = await cloudflareS3Service.uploadImageWithVariants(
      imageBuffer,
      businessId,
      photoId
    );

    logger.info({ 
      businessId, 
      photoId, 
      variants: Object.keys(uploadedVariants),
      isMainPhoto,
      originalSize: imageBuffer.length 
    }, 'Successfully uploaded photo variants');

    return {
      sourceId: photoId,
      source: 'GOOGLE',
      width: null, // We'll get this from Google API later
      height: null,
      url: buildGooglePhotoUrl(photoId),
      s3Key: uploadedVariants.original || null,
      s3KeyThumbnail: uploadedVariants.thumbnail || null,
      s3KeySmall: uploadedVariants.small || null,
      s3KeyMedium: uploadedVariants.medium || null,
      s3KeyLarge: uploadedVariants.large || null,
      mainPhoto: isMainPhoto,
      format: 'jpeg',
      fileSize: imageBuffer.length,
      lastProcessed: new Date(),
      businessId
    };

  } catch (error) {
    // Handle cost control blocks gracefully
    if (error instanceof Error && error.message.includes('blocked')) {
      logger.warn({ 
        businessId, 
        photoId, 
        reason: error.message 
      }, 'Photo upload blocked by cost controls');
      
      // Return photo record without S3 keys (will use external URL)
      return {
        sourceId: photoId,
        source: 'GOOGLE',
        width: null,
        height: null,
        url: buildGooglePhotoUrl(photoId),
        s3Key: null,
        s3KeyThumbnail: null,
        s3KeySmall: null,
        s3KeyMedium: null,
        s3KeyLarge: null,
        mainPhoto: isMainPhoto,
        businessId
      };
    }

    logger.error({ 
      err: error, 
      businessId, 
      photoId 
    }, 'Failed to process and upload photo');
    
    return null;
  }
};

// Main photo processing function
const processBusinessPhotos = async (businessId: string): Promise<void> => {
  try {
    // Get business with raw source data
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        sourceBusinesses: true,
        photos: true
      }
    });

    if (!business) {
      logger.warn({ businessId }, 'Business not found for photo processing');
      return;
    }

    // Skip if photos already processed
    if (business.photos.length > 0) {
      logger.debug({ 
        businessId, 
        businessName: business.name,
        existingPhotos: business.photos.length 
      }, 'Business already has photos, skipping');
      return;
    }

    // Get raw Google data
    const googleSource = business.sourceBusinesses.find(source => source.source === 'GOOGLE');
    if (!googleSource) {
      logger.debug({ 
        businessId, 
        businessName: business.name 
      }, 'No Google source data found for business');
      return;
    }

    const rawData = googleSource.rawData as any;
    const photos = rawData?.photos;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      logger.debug({ 
        businessId, 
        businessName: business.name 
      }, 'No photos found in Google data');
      return;
    }

    // Check cost report before processing
    const costReport = await cloudflareS3Service.getCostReport();
    
    if (costReport.emergencyMode) {
      logger.warn({ 
        businessId, 
        businessName: business.name 
      }, 'Emergency mode active - skipping photo processing');
      return;
    }

    logger.info({ 
      businessId, 
      businessName: business.name,
      totalPhotos: photos.length,
      willProcess: Math.min(photos.length, PHOTO_CONFIG.maxPhotosPerBusiness)
    }, 'Starting photo processing for business');

    const processedPhotos: any[] = [];
    
    // FIXED: Sort photos to prioritize featured/main photos
    const sortedPhotos = photos.sort((a: any, b: any) => {
      // Prioritize photos with higher resolution (likely better quality)
      const aArea = (a.widthPx || 0) * (a.heightPx || 0);
      const bArea = (b.widthPx || 0) * (b.heightPx || 0);
      return bArea - aArea; // Highest resolution first
    });
    
    const photosToProcess = sortedPhotos.slice(0, PHOTO_CONFIG.maxPhotosPerBusiness);

    // Process photos sequentially to respect rate limits
    for (let index = 0; index < photosToProcess.length; index++) {
      const photo = photosToProcess[index];
      
      try {
        // Download photo from Google
        const imageBuffer = await downloadGooglePhoto(photo.name);
        
        if (!imageBuffer) {
          logger.debug({ 
            businessId, 
            photoName: photo.name 
          }, 'Skipping failed photo download');
          continue;
        }

        // Process and upload photo
        const sanitizedPhotoName = sanitizePhotoName(photo.name);
        const processedPhoto = await processAndUploadPhoto(
          imageBuffer,
          businessId,
          sanitizedPhotoName,
          index === 0 // First photo is main photo
        );

        if (processedPhoto) {
          // Add Google metadata
          processedPhoto.width = photo.widthPx;
          processedPhoto.height = photo.heightPx;
          processedPhotos.push(processedPhoto);
        }

        // Delay between photos to be gentle on rate limits
        if (index < photosToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, PHOTO_CONFIG.delayBetweenPhotos));
        }

      } catch (error) {
        logger.error({ 
          err: error, 
          businessId, 
          photoName: photo.name 
        }, 'Failed to process individual photo');
        // Continue with next photo
      }
    }

    // Save photos to database
    if (processedPhotos.length > 0) {
      await prisma.photo.createMany({
        data: processedPhotos.map(photo => ({
          id: uuidv4(),
          businessId: photo.businessId,
          sourceId: photo.sourceId,
          source: photo.source,
          width: photo.width,
          height: photo.height,
          url: photo.url,
          s3Key: photo.s3Key,
          s3KeyThumbnail: photo.s3KeyThumbnail,
          s3KeySmall: photo.s3KeySmall,
          s3KeyMedium: photo.s3KeyMedium,
          s3KeyLarge: photo.s3KeyLarge,
          mainPhoto: photo.mainPhoto,
          format: photo.format,
          fileSize: photo.fileSize,
          lastProcessed: photo.lastProcessed,
          createdOn: new Date(),
          lastFetched: new Date()
        })),
        skipDuplicates: true
      });

      // Publish photo processed event
      const photoEvent: PhotoProcessedEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        source: 'photo-processing-service',
        type: 'business.photos.processed',
        data: {
          businessId,
          photosProcessed: processedPhotos.length,
          mainPhotoSet: processedPhotos.some(p => p.mainPhoto),
          hasS3Storage: processedPhotos.some(p => p.s3Key !== null)
        }
      };

      publishEvent(photoEvent);

      logger.info({ 
        businessId, 
        businessName: business.name,
        photosProcessed: processedPhotos.length,
        mainPhotoSet: processedPhotos.some(p => p.mainPhoto),
        eventId: photoEvent.id
      }, 'Successfully processed and saved photos for business');
    }

  } catch (error) {
    logger.error({ 
      err: error, 
      businessId 
    }, 'Failed to process business photos');
  }
};

// UPDATED: Event handler for business deduplication completion (directly after dedup)
const handleBusinessDeduplicatedEvent = async (event: BusinessDeduplicatedEvent): Promise<void> => {
  try {
    logger.info({
      eventId: event.id,
      businessId: event.data.businessId,
      action: event.data.action
    }, 'Processing photos for deduplicated business');

    await processBusinessPhotos(event.data.businessId);

  } catch (error) {
    logger.error({
      err: error,
      eventId: event.id,
      businessId: event.data.businessId
    }, 'Failed to process photos for business');
  }
};

// UPDATED: Initialize photo processing service - now listens for deduplication events
export const initializePhotoProcessingService = (): void => {
  subscribeToEvent('business.deduplicated', handleBusinessDeduplicatedEvent);
  logger.info('PhotoProcessingService listening for deduplicated businesses');
};

// Export for manual processing and testing
export { processBusinessPhotos, PHOTO_CONFIG };