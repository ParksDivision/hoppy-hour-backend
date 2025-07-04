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
import { logger } from './logger/logger';
import { performance } from 'perf_hooks';
import { s3CostController } from './s3CostControl';

// CDN Configuration
interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  cacheTTL: number;
  provider: 'cloudflare' | 'cloudfront' | 'fastly' | 'bunny' | 'keycdn';
}

// Enhanced Image Service with Cost Control
class CostControlledS3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private urlCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
  private cdnConfig: CDNConfig;

  constructor(
    bucketName: string,
    s3Config: S3ClientConfig,
    cdnConfig?: CDNConfig
  ) {
    this.s3Client = new S3Client(s3Config);
    this.bucketName = bucketName;
    this.cdnConfig = cdnConfig || {
      enabled: false,
      baseUrl: '',
      cacheTTL: 86400,
      provider: 'cloudflare'
    };
  }

  // Upload with cost control
  async uploadImage(
    imageBuffer: Buffer,
    businessId: string,
    photoId: string,
    variant: string = 'original'
  ): Promise<string> {
    const key = this.generateKey(businessId, photoId, variant);
    
    return await s3CostController.executeOperation(
      'PUT',
      async () => {
        const processedBuffer = await this.processImage(imageBuffer, variant);
        
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
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

        return key;
      },
      imageBuffer.length
    );
  }

  // Get URL with CDN support and cost control
  async getImageUrl(
    key: string,
    expirationSeconds: number = 3600,
    useCDN: boolean = true
  ): Promise<string> {
    // If CDN is enabled and we're requesting a cacheable image
    if (this.cdnConfig.enabled && useCDN) {
      return this.getCDNUrl(key);
    }

    const cacheKey = `url:${key}:${expirationSeconds}`;
    const cachedUrl = this.urlCache.get<string>(cacheKey);

    if (cachedUrl) {
      return cachedUrl;
    }

    return await s3CostController.executeOperation(
      'GET',
      async () => {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        });

        const signedUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: expirationSeconds
        });

        this.urlCache.set(cacheKey, signedUrl, expirationSeconds - 60);
        return signedUrl;
      },
      0 // No data transfer for URL generation
    );
  }

  // CDN URL generation
  private getCDNUrl(key: string): string {
    if (!this.cdnConfig.enabled) {
      throw new Error('CDN is not enabled');
    }

    // Remove any leading slashes and encode the key
    const cleanKey = key.replace(/^\/+/, '');
    return `${this.cdnConfig.baseUrl}/${cleanKey}`;
  }

  // Delete with cost control
  async deleteImage(key: string): Promise<void> {
    return await s3CostController.executeOperation(
      'DELETE',
      async () => {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key
          })
        );

        // Clear from cache
        this.urlCache.del(`url:${key}`);
        
        // If using CDN, you might want to purge the cache
        if (this.cdnConfig.enabled) {
          await this.purgeCDNCache(key);
        }
      },
      0
    );
  }

  // Upload multiple variants with batch cost control
  async uploadImageWithVariants(
    imageBuffer: Buffer,
    businessId: string,
    photoId: string
  ): Promise<Record<string, string>> {
    const variants = ['thumbnail', 'small', 'medium', 'large', 'original'];
    const results: Record<string, string> = {};

    // Check if we can afford all variants
    let totalEstimatedCost = 0;
    for (const variant of variants) {
      totalEstimatedCost += s3CostController.estimateOperationCost('PUT', imageBuffer.length);
    }

    const currentCost = s3CostController.getCurrentMonthlyCost();
    if (currentCost.total + totalEstimatedCost > 20) { // $20 monthly limit
      throw new Error('Cannot upload all variants: would exceed monthly budget');
    }

    // Upload variants sequentially to avoid overwhelming rate limits
    for (const variant of variants) {
      try {
        results[variant] = await this.uploadImage(imageBuffer, businessId, photoId, variant);
        
        // Small delay between uploads to be gentle on rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Failed to upload ${variant} variant`, { error, businessId, photoId });
        // Continue with other variants
      }
    }

    return results;
  }

  // Optimized batch URL generation
  async getBatchImageUrls(
    keys: string[],
    useCDN: boolean = true
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    // If using CDN, generate URLs without S3 calls
    if (this.cdnConfig.enabled && useCDN) {
      for (const key of keys) {
        results[key] = this.getCDNUrl(key);
      }
      return results;
    }

    // Batch process with rate limiting
    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (key) => {
        try {
          const url = await this.getImageUrl(key, 3600, false); // Don't use CDN in batch
          return { key, url };
        } catch (error) {
          logger.error(`Failed to get URL for ${key}`, { error });
          return { key, url: null };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ key, url }) => {
        if (url) results[key] = url;
      });

      // Delay between batches
      if (i + batchSize < keys.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  // CDN cache purging (implement based on your CDN provider)
  private async purgeCDNCache(key: string): Promise<void> {
    if (!this.cdnConfig.enabled) return;

    try {
      switch (this.cdnConfig.provider) {
        case 'cloudflare':
          await this.purgeCloudflareCache([this.getCDNUrl(key)]);
          break;
        case 'cloudfront':
          await this.purgeCloudFrontCache([`/${key}`]);
          break;
        case 'bunny':
          await this.purgeBunnyCDNCache(key);
          break;
        // Add other CDN providers as needed
        default:
          logger.warn(`CDN cache purging not implemented for ${this.cdnConfig.provider}`);
      }
    } catch (error) {
      logger.error('Failed to purge CDN cache', { error, key });
    }
  }

  // Cloudflare cache purging
  private async purgeCloudflareCache(urls: string[]): Promise<void> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: urls }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare purge failed: ${response.statusText}`);
    }
  }

  // CloudFront cache purging
  private async purgeCloudFrontCache(paths: string[]): Promise<void> {
    // This would require AWS SDK CloudFront client
    // Implementation depends on your CloudFront setup
    logger.info('CloudFront cache purge requested', { paths });
  }

  // Bunny CDN cache purging
  private async purgeBunnyCDNCache(key: string): Promise<void> {
    const response = await fetch(`https://api.bunny.net/purge?url=${encodeURIComponent(this.getCDNUrl(key))}`, {
      method: 'POST',
      headers: {
        'AccessKey': process.env.BUNNY_API_KEY || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Bunny CDN purge failed: ${response.statusText}`);
    }
  }

  // Cost reporting
  getCostReport() {
    return s3CostController.getCostReport();
  }

  // Helper methods
  private generateKey(businessId: string, photoId: string, variant: string): string {
    const variantSuffix = variant === 'original' ? '' : `-${variant}`;
    return `businesses/${businessId}/photos/${photoId}${variantSuffix}.jpg`;
  }

  private async processImage(imageBuffer: Buffer, variant: string): Promise<Buffer> {
    const variants = {
      thumbnail: { width: 150, height: 150, quality: 70 },
      small: { width: 320, height: 240, quality: 75 },
      medium: { width: 640, height: 480, quality: 80 },
      large: { width: 1024, height: 768, quality: 85 },
      original: { width: null, height: null, quality: 90 }
    };

    const settings = variants[variant as keyof typeof variants] || variants.original;
    
    let sharpInstance = sharp(imageBuffer).withMetadata();

    if (variant !== 'original' && settings.width && settings.height) {
      sharpInstance = sharpInstance.resize(settings.width, settings.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    return sharpInstance
      .jpeg({
        quality: settings.quality,
        progressive: true,
        force: false
      })
      .toBuffer();
  }
}

// Export configured instance
const s3Config: S3ClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  maxAttempts: 3
};

const cdnConfig: CDNConfig = {
  enabled: process.env.CDN_ENABLED === 'true',
  baseUrl: process.env.CDN_BASE_URL || '',
  cacheTTL: 86400,
  provider: (process.env.CDN_PROVIDER as any) || 'cloudflare'
};

export const costControlledS3Service = new CostControlledS3Service(
  process.env.AWS_S3_BUCKET_NAME || '',
  s3Config,
  cdnConfig
);

export { CostControlledS3Service };