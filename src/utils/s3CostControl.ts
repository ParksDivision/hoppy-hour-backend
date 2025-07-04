import NodeCache from 'node-cache';
import { logger } from './logger/logger';
import prisma from '../prismaClient';

// AWS S3 Pricing (US East 1 - adjust for your region)
const S3_PRICING = {
  // Storage costs per GB per month
  STORAGE_STANDARD: 0.023,
  
  // Request costs per 1000 requests
  PUT_COPY_POST_LIST: 0.0005,
  GET_SELECT_OTHER: 0.0004,
  
  // Data transfer costs per GB
  DATA_TRANSFER_OUT: 0.09,
  
  // CloudFront pricing (if using AWS CDN)
  CLOUDFRONT_REQUEST: 0.0075 / 10000, // per 10k requests
  CLOUDFRONT_DATA_TRANSFER: 0.085 // per GB
};

interface CostEstimate {
  storage: number;
  requests: number;
  dataTransfer: number;
  total: number;
}

interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  maxMonthlyCost: number;
  emergencyThreshold: number; // Percentage of monthly budget
}

interface S3Operation {
  type: 'PUT' | 'GET' | 'DELETE' | 'LIST';
  timestamp: Date;
  cost: number;
  bytes?: number;
}

class S3CostController {
  private cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
  private operationLog: S3Operation[] = [];
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig = {
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000,
    maxMonthlyCost: 20.00,
    emergencyThreshold: 80
  }) {
    this.config = config;
    this.loadMonthlyOperations();
  }

  // Token bucket rate limiter
  private tokenBucket = {
    tokens: 1000,
    maxTokens: 1000,
    refillRate: 10, // tokens per minute
    lastRefill: Date.now()
  };

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

  private async loadMonthlyOperations(): Promise<void> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // You'll need to create this table in your Prisma schema
      const operations = await prisma.s3Operation?.findMany({
        where: {
          createdAt: {
            gte: startOfMonth
          }
        }
      }) || [];

      this.operationLog = operations.map(op => ({
        type: op.operationType as 'PUT' | 'GET' | 'DELETE' | 'LIST',
        timestamp: op.createdAt,
        cost: op.estimatedCost,
        bytes: op.bytes || undefined
      }));
    } catch (error) {
      logger.warn('Could not load monthly operations from database', { error });
    }
  }

  private async logOperation(operation: S3Operation): Promise<void> {
    this.operationLog.push(operation);
    
    try {
      // Log to database for persistence
      await prisma.s3Operation?.create({
        data: {
          operationType: operation.type,
          estimatedCost: operation.cost,
          bytes: operation.bytes,
          createdAt: operation.timestamp
        }
      });
    } catch (error) {
      logger.error('Failed to log S3 operation to database', { error, operation });
    }
  }

  public estimateOperationCost(
    operationType: 'PUT' | 'GET' | 'DELETE' | 'LIST',
    bytes: number = 0
  ): number {
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

  public getCurrentMonthlyCost(): CostEstimate {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyOps = this.operationLog.filter(
      op => op.timestamp >= startOfMonth
    );

    const requests = monthlyOps.reduce((sum, op) => sum + op.cost, 0);
    
    // Estimate storage costs (you'll need to track this separately)
    const storage = 0; // Implement based on your storage tracking
    const dataTransfer = 0; // Implement based on your data transfer tracking
    
    return {
      storage,
      requests,
      dataTransfer,
      total: storage + requests + dataTransfer
    };
  }

  public async checkRateLimit(
    operationType: 'PUT' | 'GET' | 'DELETE' | 'LIST',
    bytes: number = 0
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    this.refillTokens();

    // Check token bucket
    if (this.tokenBucket.tokens < 1) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: 60 // seconds
      };
    }

    // Check hourly limit
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyOps = this.operationLog.filter(op => op.timestamp >= hourAgo);
    
    if (hourlyOps.length >= this.config.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: 'Hourly limit exceeded',
        retryAfter: 3600
      };
    }

    // Check daily limit
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyOps = this.operationLog.filter(op => op.timestamp >= dayAgo);
    
    if (dailyOps.length >= this.config.maxRequestsPerDay) {
      return {
        allowed: false,
        reason: 'Daily limit exceeded',
        retryAfter: 86400
      };
    }

    // Check monthly cost limit
    const currentCost = this.getCurrentMonthlyCost();
    const estimatedCost = this.estimateOperationCost(operationType, bytes);
    
    if (currentCost.total + estimatedCost > this.config.maxMonthlyCost) {
      return {
        allowed: false,
        reason: 'Monthly budget exceeded',
        retryAfter: this.getSecondsUntilNextMonth()
      };
    }

    // Check emergency threshold
    const costPercentage = (currentCost.total / this.config.maxMonthlyCost) * 100;
    if (costPercentage > this.config.emergencyThreshold) {
      logger.warn('S3 costs approaching monthly limit', {
        currentCost: currentCost.total,
        percentage: costPercentage,
        limit: this.config.maxMonthlyCost
      });
    }

    return { allowed: true };
  }

  public async executeOperation<T>(
    operationType: 'PUT' | 'GET' | 'DELETE' | 'LIST',
    operation: () => Promise<T>,
    bytes: number = 0
  ): Promise<T> {
    const rateCheck = await this.checkRateLimit(operationType, bytes);
    
    if (!rateCheck.allowed) {
      throw new Error(`S3 operation blocked: ${rateCheck.reason}. Retry after ${rateCheck.retryAfter} seconds`);
    }

    // Consume token
    this.tokenBucket.tokens--;

    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      const operationRecord: S3Operation = {
        type: operationType,
        timestamp: new Date(),
        cost: this.estimateOperationCost(operationType, bytes),
        bytes
      };

      await this.logOperation(operationRecord);
      
      logger.debug('S3 operation completed', {
        type: operationType,
        duration: Date.now() - startTime,
        cost: operationRecord.cost,
        bytes
      });

      return result;
    } catch (error) {
      logger.error('S3 operation failed', {
        type: operationType,
        duration: Date.now() - startTime,
        error
      });
      throw error;
    }
  }

  private getSecondsUntilNextMonth(): number {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return Math.floor((nextMonth.getTime() - now.getTime()) / 1000);
  }

  public getCostReport(): {
    currentMonth: CostEstimate;
    dailyAverage: number;
    projectedMonthly: number;
    remainingBudget: number;
    recommendedDailyLimit: number;
  } {
    const currentCost = this.getCurrentMonthlyCost();
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    
    const dailyAverage = currentCost.total / dayOfMonth;
    const projectedMonthly = dailyAverage * daysInMonth;
    const remainingBudget = this.config.maxMonthlyCost - currentCost.total;
    const remainingDays = daysInMonth - dayOfMonth;
    const recommendedDailyLimit = remainingDays > 0 ? remainingBudget / remainingDays : 0;

    return {
      currentMonth: currentCost,
      dailyAverage,
      projectedMonthly,
      remainingBudget,
      recommendedDailyLimit
    };
  }
}

export const s3CostController = new S3CostController();
export { S3CostController };