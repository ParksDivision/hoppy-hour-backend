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
import prisma from '../prismaClient';

// AWS S3 Pricing (US East 1)
const S3_PRICING = {
  PUT_COPY_POST_LIST: 0.0005, // per 1000 requests
  GET_SELECT_OTHER: 0.0004,   // per 1000 requests
  DATA_TRANSFER_OUT: 0.09,    // per GB
};

// Cloudflare pricing
const CLOUDFLARE_PRICING = {
  BANDWIDTH: 0.0, // Free tier: 100GB/month, Pro: unlimited
  REQUESTS: 0.0,  // Free tier: 100k requests/month, Pro: unlimited
  IMAGE_OPTIMIZATION: 0.001, // $1 per 1000 transformations (Pro plan)
};

interface ImageVariantSettings {
  width: number | null;
  height: number | null;
  quality: number;
}

const IMAGE_VARIANTS: Record<string, ImageVariantSettings> = {
  thumbnail: { width: 150, height: 150, quality: 70 },
  small: { width: 320, height: 240, quality: 75 },
  medium: { width: 640, height: 480, quality: 80 },
  large: { width: 1024, height: 768, quality: 85 },
  original: { width: null, height: null, quality: 90 }
};

interface CostEstimate {
  s3Storage: number;
  s3Requests: number;
  s3DataTransfer: number;
  cloudflareRequests: number;
  cloudflareBandwidth: number;
  total: number;
}

interface CloudflareConfig {
  zoneId: string;
  apiToken: string;
  baseUrl: string;
  enabled: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  emergencyMode?: boolean;
}

class CloudflareS3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private urlCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
  private cloudflareConfig: CloudflareConfig;
  private monthlyBudget = 20.00; // $20 monthly limit
  
  // Token bucket for rate limiting
  private tokenBucket = {
    tokens: 1000,
    maxTokens: 1000,
    refillRate: 10, // tokens per minute
    lastRefill: Date.now()
  };

  constructor(
    bucketName: string,
    s3Config: S3ClientConfig,
    cloudflareConfig: CloudflareConfig
  ) {
    this.s3Client = new S3Client(s3Config);
    this.bucketName = bucketName;
    this.cloudflareConfig = cloudflareConfig;
  }

  // ====================
  // COST CONTROL METHODS
  // ====================

  private async getCurrentMonthBudget() {
    const monthYear = new Date().toISOString().slice(0, 7); // "2025-01"
    
    let budget = await prisma.costBudget.findUnique({
      where: { monthYear }
    });

    if (!budget) {
      budget = await prisma.costBudget.create({
        data: {
          monthYear,
          totalBudget: this.monthlyBudget,
          currentSpent: 0,
          isActive: true
        }
      });
    }

    return budget;
  }

  private async getCurrentMonthlyCost(): Promise<CostEstimate> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const operations = await prisma.s3Operation.findMany({
      where: {
        createdAt: { gte: startOfMonth }
      }
    });

    const s3Requests = operations.reduce((sum, op) => sum + op.estimatedCost, 0);
    const budget = await this.getCurrentMonthBudget();

    return {
      s3Storage: 0, // Calculated separately
      s3Requests,
      s3DataTransfer: 0, // Calculated from bytes transferred
      cloudflareRequests: budget.cdnRequestsUsed * CLOUDFLARE_PRICING.REQUESTS,
      cloudflareBandwidth: budget.cdnBandwidthUsed * CLOUDFLARE_PRICING.BANDWIDTH,
      total: budget.currentSpent
    };
  }

  private estimateOperationCost(operationType: 'PUT' | 'GET' | 'DELETE' | 'LIST', bytes: number = 0): number {
    switch (operationType) {
      case 'PUT':
        return (S3_PRICING.PUT_COPY_POST_LIST / 1000) + 
               (bytes / (1024 * 1024 * 1024)) * S3_PRICING.DATA_TRANSFER_OUT;
      case 'GET':
        return (S3_PRICING.GET_SELECT_OTHER / 1000) + 
               (bytes / (1024 * 1024 * 1024)) * S3_PRICING.DATA_TRANSFER_OUT;
      case 'DELETE':
        return 0; // DELETE requests are free
      case 'LIST':
        return S3_PRICING.PUT_COPY_POST_LIST / 1000;
      default:
        return 0;
    }
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.tokenBucket.lastRefill) / 1000 / 60; // minutes
    const tokensToAdd = Math.floor(timePassed * this.tokenBucket.refillRate);
    
    this.tokenBucket.tokens = Math.min(
      this.tokenBucket.maxTokens,
      this.tokenBucket.tokens + tokensToAdd
    );
    this.tokenBucket.lastRefill = now;
  }

  private async checkRateLimit(
    operationType: 'PUT' | 'GET' | 'DELETE' | 'LIST',
    bytes: number = 0
  ): Promise<RateLimitResult> {
    this.refillTokens();
    const budget = await this.getCurrentMonthBudget();

    // Emergency mode check - if budget exceeded, only allow CDN URLs
    if (budget.emergencyMode) {
      return {
        allowed: false,
        reason: 'Emergency mode active - budget exceeded',
        emergencyMode: true,
        retryAfter: this.getSecondsUntilNextMonth()
      };
    }

    // Token bucket check
    if (this.tokenBucket.tokens < 1) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: 60
      };
    }

    // Monthly cost check
    const currentCost = await this.getCurrentMonthlyCost();
    const estimatedCost = this.estimateOperationCost(operationType, bytes);
    
    if (currentCost.total + estimatedCost > this.monthlyBudget) {
      // Enable emergency mode
      await prisma.costBudget.update({
        where: { monthYear: budget.monthYear },
        data: { 
          emergencyMode: true,
          budgetExceeded: true 
        }
      });

      return {
        allowed: false,
        reason: 'Monthly budget exceeded',
        emergencyMode: true,
        retryAfter: this.getSecondsUntilNextMonth()
      };
    }

    // Warning threshold check
    const costPercentage = (currentCost.total / this.monthlyBudget) * 100;
    if (costPercentage > 80 && !budget.alertSent) {
      await prisma.costBudget.update({
        where: { monthYear: budget.monthYear },
        data: { alertSent: true }
      });

      logger.warn('S3 costs approaching monthly limit', {
        currentCost: currentCost.total,
        percentage: costPercentage,
        limit: this.monthlyBudget
      });
    }

    return { allowed: true };
  }

  private async logOperation(
    operationType: 'PUT' | 'GET' | 'DELETE' | 'LIST',
    cost: number,
    bytes?: number,
    businessId?: string,
    photoId?: string,
    s3Key?: string,
    cdnPurged: boolean = false
  ): Promise<void> {
    try {
      await prisma.s3Operation.create({
        data: {
          operationType,
          estimatedCost: cost,
          bytes,
          businessId,
          photoId,
          s3Key,
          cdnPurged
        }
      });

      // Update monthly budget
      const budget = await this.getCurrentMonthBudget();
      await prisma.costBudget.update({
        where: { monthYear: budget.monthYear },
        data: {
          currentSpent: budget.currentSpent + cost
        }
      });

    } catch (error) {
      logger.error('Failed to log S3 operation', { error, operationType, cost });
    }
  }

  private getSecondsUntilNextMonth(): number {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return Math.floor((nextMonth.getTime() - now.getTime()) / 1000);
  }

  // =====================
  // CLOUDFLARE CDN METHODS
  // =====================

  private getCloudflareUrl(key: string): string {
    if (!this.cloudflareConfig.enabled) {
      throw new Error('Cloudflare CDN is not enabled');
    }

    // Remove any leading slashes and construct CDN URL
    const cleanKey = key.replace(/^\/+/, '');
    return `${this.cloudflareConfig.baseUrl}/${cleanKey}`;
  }

  private async purgeCloudflareCache(urls: string[]): Promise<boolean> {
    if (!this.cloudflareConfig.enabled) return false;

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cloudflareConfig.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.cloudflareConfig.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: urls }),
        }
      );

      if (!response.ok) {
        logger.error('Cloudflare cache purge failed', {
          status: response.status,
          statusText: response.statusText,
          urls
        });
        return false;
      }

      logger.info('Cloudflare cache purged successfully', { urls });
      return true;

    } catch (error) {
      logger.error('Failed to purge Cloudflare cache', { error, urls });
      return false;
    }
  }

  // ===================
  // IMAGE PROCESSING
  // ===================

  private async processImage(imageBuffer: Buffer, variant: string): Promise<Buffer> {
    const settings = IMAGE_VARIANTS[variant] || IMAGE_VARIANTS.original;
    
    let sharpInstance = sharp(imageBuffer, {
      failOnError: false,
      density: 300
    }).withMetadata();

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

  private generateKey(businessId: string, photoId: string, variant: string): string {
    const variantSuffix = variant === 'original' ? '' : `-${variant}`;
    return `businesses/${businessId}/photos/${photoId}${variantSuffix}.jpg`;
  }

  // ===================
  // PUBLIC API METHODS
  // ===================

  async uploadImage(
    imageBuffer: Buffer,
    businessId: string,
    photoId: string,
    variant: string = 'original'
  ): Promise<string> {
    const key = this.generateKey(businessId, photoId, variant);
    const rateCheck = await this.checkRateLimit('PUT', imageBuffer.length);

    if (!rateCheck.allowed) {
      throw new Error(`Upload blocked: ${rateCheck.reason}`);
    }

    this.tokenBucket.tokens--;
    const startTime = performance.now();

    try {
      const processedBuffer = await this.processImage(imageBuffer, variant);
      
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: processedBuffer,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000', // 1 year cache
          Metadata: {
            businessId,
            photoId,
            variant,
            processedAt: new Date().toISOString()
          }
        })
      );

      const cost = this.estimateOperationCost('PUT', processedBuffer.length);
      await this.logOperation('PUT', cost, processedBuffer.length, businessId, photoId, key);

      logger.info('Image uploaded successfully', {
        key,
        variant,
        size: processedBuffer.length,
        cost,
        duration: performance.now() - startTime
      });

      return key;

    } catch (error) {
      logger.error('Failed to upload image', { error, key, variant });
      throw error;
    }
  }

  async uploadImageWithVariants(
    imageBuffer: Buffer,
    businessId: string,
    photoId: string
  ): Promise<Record<string, string>> {
    const variants = Object.keys(IMAGE_VARIANTS);
    const results: Record<string, string> = {};

    // Check if we can afford all variants
    let totalEstimatedCost = 0;
    for (const variant of variants) {
      totalEstimatedCost += this.estimateOperationCost('PUT', imageBuffer.length);
    }

    const currentCost = await this.getCurrentMonthlyCost();
    if (currentCost.total + totalEstimatedCost > this.monthlyBudget) {
      // Only upload essential variants
      const essentialVariants = ['thumbnail', 'medium', 'original'];
      logger.warn('Uploading only essential variants due to budget constraints', {
        requestedVariants: variants.length,
        essentialVariants: essentialVariants.length
      });
      
      for (const variant of essentialVariants) {
        try {
          results[variant] = await this.uploadImage(imageBuffer, businessId, photoId, variant);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        } catch (error) {
          logger.error(`Failed to upload ${variant} variant`, { error });
        }
      }
    } else {
      // Upload all variants
      for (const variant of variants) {
        try {
          results[variant] = await this.uploadImage(imageBuffer, businessId, photoId, variant);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        } catch (error) {
          logger.error(`Failed to upload ${variant} variant`, { error });
        }
      }
    }

    return results;
  }

  async getImageUrl(
    key: string,
    useCloudflare: boolean = true,
    expirationSeconds: number = 3600
  ): Promise<string> {
    // Always prefer Cloudflare CDN if enabled and requested
    if (this.cloudflareConfig.enabled && useCloudflare) {
      return this.getCloudflareUrl(key);
    }

    // Check rate limits for S3 signed URL generation
    const rateCheck = await this.checkRateLimit('GET', 0);
    if (!rateCheck.allowed) {
      // If in emergency mode, force Cloudflare URL even if not requested
      if (rateCheck.emergencyMode && this.cloudflareConfig.enabled) {
        logger.warn('Emergency mode: forcing Cloudflare URL', { key });
        return this.getCloudflareUrl(key);
      }
      throw new Error(`URL generation blocked: ${rateCheck.reason}`);
    }

    // Check cache first
    const cacheKey = `url:${key}:${expirationSeconds}`;
    const cachedUrl = this.urlCache.get<string>(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    this.tokenBucket.tokens--;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expirationSeconds
      });

      this.urlCache.set(cacheKey, signedUrl, expirationSeconds - 60);

      const cost = this.estimateOperationCost('GET', 0);
      await this.logOperation('GET', cost, 0, undefined, undefined, key);

      return signedUrl;

    } catch (error) {
      logger.error('Failed to generate signed URL', { error, key });
      throw error;
    }
  }

  async deleteImage(key: string): Promise<void> {
    const rateCheck = await this.checkRateLimit('DELETE', 0);
    if (!rateCheck.allowed) {
      throw new Error(`Delete operation blocked: ${rateCheck.reason}`);
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      );

      // Purge from Cloudflare cache
      let cdnPurged = false;
      if (this.cloudflareConfig.enabled) {
        const cloudflareUrl = this.getCloudflareUrl(key);
        cdnPurged = await this.purgeCloudflareCache([cloudflareUrl]);
      }

      // Clear from local cache
      this.urlCache.del(`url:${key}`);

      const cost = this.estimateOperationCost('DELETE', 0);
      await this.logOperation('DELETE', cost, 0, undefined, undefined, key, cdnPurged);

      logger.info('Image deleted successfully', { key, cdnPurged });

    } catch (error) {
      logger.error('Failed to delete image', { error, key });
      throw error;
    }
  }

  async getBatchImageUrls(
    keys: string[],
    useCloudflare: boolean = true
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    // If using Cloudflare, generate URLs without any S3 calls
    if (this.cloudflareConfig.enabled && useCloudflare) {
      for (const key of keys) {
        results[key] = this.getCloudflareUrl(key);
      }
      return results;
    }

    // Process in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (key) => {
        try {
          const url = await this.getImageUrl(key, false); // Don't use Cloudflare in batch
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

  // ===================
  // REPORTING METHODS
  // ===================

  async getCostReport(): Promise<{
    currentMonth: CostEstimate;
    dailyAverage: number;
    projectedMonthly: number;
    remainingBudget: number;
    emergencyMode: boolean;
    cloudflareStats: {
      requestsUsed: number;
      bandwidthUsed: number;
    };
  }> {
    const currentCost = await this.getCurrentMonthlyCost();
    const budget = await this.getCurrentMonthBudget();
    
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    const dailyAverage = currentCost.total / dayOfMonth;
    const projectedMonthly = dailyAverage * daysInMonth;
    const remainingBudget = this.monthlyBudget - currentCost.total;

    return {
      currentMonth: currentCost,
      dailyAverage,
      projectedMonthly,
      remainingBudget,
      emergencyMode: budget.emergencyMode,
      cloudflareStats: {
        requestsUsed: budget.cdnRequestsUsed,
        bandwidthUsed: budget.cdnBandwidthUsed
      }
    };
  }

  async getUsageStats(): Promise<{
    totalOperations: number;
    operationsByType: Record<string, number>;
    costByDay: Array<{ date: string; cost: number }>;
    topExpensiveOperations: Array<{
      type: string;
      cost: number;
      timestamp: Date;
      businessId?: string;
    }>;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const operations = await prisma.s3Operation.findMany({
      where: {
        createdAt: { gte: startOfMonth }
      },
      orderBy: { estimatedCost: 'desc' },
      take: 100
    });

    const totalOperations = operations.length;
    
    const operationsByType = operations.reduce((acc, op) => {
      acc[op.operationType] = (acc[op.operationType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by day
    const costByDay = operations.reduce((acc, op) => {
      const date = op.createdAt.toISOString().split('T')[0];
      const existing = acc.find(item => item.date === date);
      if (existing) {
        existing.cost += op.estimatedCost;
      } else {
        acc.push({ date, cost: op.estimatedCost });
      }
      return acc;
    }, [] as Array<{ date: string; cost: number }>);

    const topExpensiveOperations = operations.slice(0, 10).map(op => ({
      type: op.operationType,
      cost: op.estimatedCost,
      timestamp: op.createdAt,
      businessId: op.businessId || undefined
    }));

    return {
      totalOperations,
      operationsByType,
      costByDay,
      topExpensiveOperations
    };
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

const cloudflareConfig: CloudflareConfig = {
  zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  baseUrl: process.env.CLOUDFLARE_CDN_BASE_URL || '',
  enabled: process.env.CLOUDFLARE_CDN_ENABLED === 'true'
};

export const cloudflareS3Service = new CloudflareS3Service(
  process.env.AWS_S3_BUCKET_NAME || '',
  s3Config,
  cloudflareConfig
);

export { CloudflareS3Service };