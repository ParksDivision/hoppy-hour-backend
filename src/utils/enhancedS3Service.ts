import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3ClientConfig
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import NodeCache from 'node-cache';
import { logger } from '../lib/logger';
import { performance } from 'perf_hooks';

// Types
type ImageVariantSettings = {
  width: number | null;
  height: number | null;
  quality: number;
};

const IMAGE_VARIANTS: Record<string, ImageVariantSettings> = {
  thumbnail: { width: 150, height: 150, quality: 70 },
  small: { width: 320, height: 240, quality: 75 },
  medium: { width: 640, height: 480, quality: 80 },
  large: { width: 1024, height: 768, quality: 85 },
  original: { width: null, height: null, quality: 90 }
};

type ImageVariant = keyof typeof IMAGE_VARIANTS;

interface UploadMetrics {
  processingTime: number;
  uploadTime: number;
  totalTime: number;
  size: number;
  variant: string;
}

// Configuration
const urlCache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600,
  useClones: false
});

const metricsCache = new NodeCache({ stdTTL: 86400 });

const s3Config: S3ClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  maxAttempts: 3
};

const s3Client = new S3Client(s3Config);
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';

// Helper functions
const getCacheKey = (key: string, variant?: ImageVariant): string => 
  `${key}:${variant || 'original'}`;

const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let attempt = 1;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      const delay = initialDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
};

const storeMetrics = (key: string, metrics: UploadMetrics): void => {
  const metricsKey = `metrics:${key}`;
  const existingMetrics = metricsCache.get<UploadMetrics[]>(metricsKey) || [];
  metricsCache.set(metricsKey, [...existingMetrics, metrics]);
};

const processImage = async (
  imageBuffer: Buffer,
  variant: ImageVariant
): Promise<Buffer> => {
  try {
    console.log(`Processing image variant: ${variant}, buffer size: ${imageBuffer.length}`);
    
    const settings = IMAGE_VARIANTS[variant];
    const sharpInstance = sharp(imageBuffer, {
      failOnError: false, // Try to process even if the image has errors
      density: 300 // Higher density for better quality
    }).withMetadata();

    if (variant !== 'original') {
      sharpInstance.resize(settings.width, settings.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Always convert to JPEG for consistency
    return sharpInstance
      .jpeg({
        quality: settings.quality,
        progressive: true,
        force: false,
        chromaSubsampling: '4:4:4'
      })
      .toBuffer();
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

// Main functions
export const uploadImage = async (
  imageBuffer: Buffer,
  businessId: string,
  photoId: string,
  variant: ImageVariant = 'original'
): Promise<string> => {
  const startTime = performance.now();
  let processingTime = 0;
  let uploadTime = 0;

  try {
    const processStart = performance.now();
    const processedBuffer = await processImage(imageBuffer, variant);
    processingTime = performance.now() - processStart;

    const variantSuffix = variant === 'original' ? '' : `-${variant}`;
    const key = `businesses/${businessId}/photos/${photoId}${variantSuffix}.jpg`;

    const uploadStart = performance.now();
    await withRetry(async () => {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: processedBuffer,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000',
          Metadata: {
            businessId,
            photoId,
            variant,
            processedAt: new Date().toISOString()
          }
        })
      );
    });

    uploadTime = performance.now() - uploadStart;

    const totalTime = performance.now() - startTime;
    const metrics: UploadMetrics = {
      processingTime,
      uploadTime,
      totalTime,
      size: processedBuffer.length,
      variant
    };
    
    storeMetrics(key, metrics);

    return key;
  } catch (error) {
    logger.error(
      { 
        err: error, 
        businessId, 
        photoId,
        variant,
        processingTime,
        uploadTime
      },
      'Failed to upload image to S3'
    );
    throw error;
  }
};

export const uploadImageWithVariants = async (
  imageBuffer: Buffer,
  businessId: string,
  photoId: string
): Promise<Record<ImageVariant, string>> => {
  try {
    const results = await Promise.all(
      Object.keys(IMAGE_VARIANTS).map(variant =>
        uploadImage(
          imageBuffer,
          businessId,
          photoId,
          variant as ImageVariant
        )
      )
    );

    return Object.keys(IMAGE_VARIANTS).reduce((acc, variant, index) => ({
      ...acc,
      [variant]: results[index]
    }), {} as Record<ImageVariant, string>);
  } catch (error) {
    logger.error(
      { err: error, businessId, photoId },
      'Failed to upload image variants'
    );
    throw error;
  }
};

export const getImageUrl = async (
  key: string,
  expirationSeconds: number = 3600
): Promise<string> => {
  const cacheKey = getCacheKey(key);
  const cachedUrl = urlCache.get<string>(cacheKey);

  if (cachedUrl) {
    return cachedUrl;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: expirationSeconds
    });

    urlCache.set(cacheKey, signedUrl, expirationSeconds - 60);

    return signedUrl;
  } catch (error) {
    logger.error({ err: error, key }, 'Failed to generate signed URL');
    throw error;
  }
};

export const deleteImage = async (key: string): Promise<void> => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      })
    );

    urlCache.del(getCacheKey(key));
    metricsCache.del(`metrics:${key}`);
  } catch (error) {
    logger.error({ err: error, key }, 'Failed to delete image from S3');
    throw error;
  }
};

export const cleanupUnusedImages = async (
  olderThanDays: number = 30
): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'businesses/'
    });

    const response = await s3Client.send(command);
    
    if (!response.Contents) return;

    const deletionPromises = response.Contents
      .filter(obj => obj.LastModified && obj.LastModified < cutoffDate)
      .map(obj => deleteImage(obj.Key!));

    await Promise.all(deletionPromises);

    logger.info(
      { deletedCount: deletionPromises.length },
      'Completed cleanup of unused images'
    );
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to cleanup unused images'
    );
    throw error;
  }
};

export const getMetrics = (): Record<string, UploadMetrics[]> => {
  const metrics: Record<string, UploadMetrics[]> = {};
  const keys = metricsCache.keys();
  
  keys.forEach(key => {
    const value = metricsCache.get<UploadMetrics[]>(key);
    if (value) {
      metrics[key] = value;
    }
  });

  return metrics;
};