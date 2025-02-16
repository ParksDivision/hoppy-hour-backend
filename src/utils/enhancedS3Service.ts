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
  
  // Image size variants for responsive images
  const IMAGE_VARIANTS = {
    thumbnail: { width: 150, height: 150, quality: 70 },
    small: { width: 320, height: 240, quality: 75 },
    medium: { width: 640, height: 480, quality: 80 },
    large: { width: 1024, height: 768, quality: 85 },
    original: { width: null, height: null, quality: 90 }
  } as const;
  
  type ImageVariant = keyof typeof IMAGE_VARIANTS;
  
  // Cache configuration
  const urlCache = new NodeCache({ 
    stdTTL: 3600, // 1 hour
    checkperiod: 600, // Check for expired keys every 10 minutes
    useClones: false
  });
  
  // Performance metrics cache
  const metricsCache = new NodeCache({ stdTTL: 86400 }); // 24 hours
  
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
  
  interface UploadMetrics {
    processingTime: number;
    uploadTime: number;
    totalTime: number;
    size: number;
    variant: string;
  }
  
  // Simple retry function with exponential backoff
  async function withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
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
  }
  
  export class OptimizedS3Service {
    private static getCacheKey(key: string, variant?: ImageVariant): string {
      return `${key}:${variant || 'original'}`;
    }
  
    private static async processImage(
      imageBuffer: Buffer,
      variant: ImageVariant
    ): Promise<Buffer> {
      const settings = IMAGE_VARIANTS[variant];
      const sharpInstance = sharp(imageBuffer).withMetadata();
  
      if (variant !== 'original') {
        if (settings.width && settings.height) {
          sharpInstance.resize(settings.width, settings.height, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }
  
      // Use WebP for all images (good balance of compression and compatibility)
      return sharpInstance
        .webp({
          quality: settings.quality,
          effort: 6, // Higher effort = better compression but slower
          lossless: false,
          nearLossless: true
        })
        .toBuffer();
    }
  
    static async uploadImage(
      imageBuffer: Buffer,
      businessId: string,
      photoId: string,
      variant: ImageVariant = 'original'
    ): Promise<string> {
      const startTime = performance.now();
      let processingTime = 0;
      let uploadTime = 0;
  
      try {
        // Process image
        const processStart = performance.now();
        const processedBuffer = await this.processImage(imageBuffer, variant);
        processingTime = performance.now() - processStart;
  
        const variantSuffix = variant === 'original' ? '' : `-${variant}`;
        const key = `businesses/${businessId}/photos/${photoId}${variantSuffix}.webp`;
  
        // Upload to S3 with retry logic
        const uploadStart = performance.now();
        await withRetry(async () => {
          await s3Client.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
              Body: processedBuffer,
              ContentType: 'image/webp',
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
  
        // Store metrics
        const totalTime = performance.now() - startTime;
        const metrics: UploadMetrics = {
          processingTime,
          uploadTime,
          totalTime,
          size: processedBuffer.length,
          variant
        };
        
        this.storeMetrics(key, metrics);
  
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
    }
  
    static async uploadImageWithVariants(
      imageBuffer: Buffer,
      businessId: string,
      photoId: string
    ): Promise<Record<ImageVariant, string>> {
      try {
        // Upload all variants in parallel
        const results = await Promise.all(
          Object.keys(IMAGE_VARIANTS).map(variant =>
            this.uploadImage(
              imageBuffer,
              businessId,
              photoId,
              variant as ImageVariant
            )
          )
        );
  
        // Create record mapping variant to S3 key
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
    }
  
    static async getImageUrl(
      key: string,
      expirationSeconds: number = 3600
    ): Promise<string> {
      const cacheKey = this.getCacheKey(key);
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
  
        // Cache URL with slightly shorter TTL
        urlCache.set(cacheKey, signedUrl, expirationSeconds - 60);
  
        return signedUrl;
      } catch (error) {
        logger.error({ err: error, key }, 'Failed to generate signed URL');
        throw error;
      }
    }
  
    static async deleteImage(key: string): Promise<void> {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
          })
        );
  
        // Clear cache
        urlCache.del(this.getCacheKey(key));
        metricsCache.del(`metrics:${key}`);
      } catch (error) {
        logger.error({ err: error, key }, 'Failed to delete image from S3');
        throw error;
      }
    }
  
    static async cleanupUnusedImages(
      olderThanDays: number = 30
    ): Promise<void> {
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
          .map(obj => this.deleteImage(obj.Key!));
  
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
    }
  
    private static storeMetrics(key: string, metrics: UploadMetrics): void {
      const metricsKey = `metrics:${key}`;
      const existingMetrics = metricsCache.get<UploadMetrics[]>(metricsKey) || [];
      metricsCache.set(metricsKey, [...existingMetrics, metrics]);
    }
  
    static getMetrics(): Record<string, UploadMetrics[]> {
      const metrics: Record<string, UploadMetrics[]> = {};
      const keys = metricsCache.keys();
      
      keys.forEach(key => {
        const value = metricsCache.get<UploadMetrics[]>(key);
        if (value) {
          metrics[key] = value;
        }
      });
  
      return metrics;
    }
  }