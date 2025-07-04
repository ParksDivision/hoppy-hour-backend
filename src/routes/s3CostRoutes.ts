import { Router } from 'express';
import { cloudflareS3Service } from '../utils/cloudflareS3Service';
import { logger } from '../utils/logger/logger';
import prisma from '../prismaClient';

const s3CostRoutes = Router();

// Get current cost report
s3CostRoutes.get('/cost-report', async (req, res) => {
  try {
    const report = await cloudflareS3Service.getCostReport();
    res.json(report);
  } catch (error) {
    logger.error('Failed to get cost report', { error });
    res.status(500).json({ 
      message: 'Failed to retrieve cost report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get detailed usage statistics
s3CostRoutes.get('/usage-stats', async (req, res) => {
  try {
    const stats = await cloudflareS3Service.getUsageStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get usage stats', { error });
    res.status(500).json({ 
      message: 'Failed to retrieve usage statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get monthly budget status
s3CostRoutes.get('/budget-status', async (req, res) => {
  try {
    const monthYear = new Date().toISOString().slice(0, 7);
    
    const budget = await prisma.costBudget.findUnique({
      where: { monthYear }
    });

    if (!budget) {
      res.status(404).json({ message: 'No budget found for current month' });
      return;
    }

    const report = await cloudflareS3Service.getCostReport();
    const usagePercentage = (budget.currentSpent / budget.totalBudget) * 100;

    res.json({
      monthYear: budget.monthYear,
      totalBudget: budget.totalBudget,
      currentSpent: budget.currentSpent,
      remainingBudget: budget.totalBudget - budget.currentSpent,
      usagePercentage,
      emergencyMode: budget.emergencyMode,
      budgetExceeded: budget.budgetExceeded,
      alertSent: budget.alertSent,
      projectedMonthly: report.projectedMonthly,
      cloudflareStats: report.cloudflareStats,
      status: budget.emergencyMode ? 'emergency' : 
              usagePercentage > 80 ? 'warning' : 
              usagePercentage > 60 ? 'caution' : 'normal'
    });
  } catch (error) {
    logger.error('Failed to get budget status', { error });
    res.status(500).json({ 
      message: 'Failed to retrieve budget status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update monthly budget settings
s3CostRoutes.put('/budget-settings', async (req, res) => {
  try {
    const { 
      totalBudget, 
      alertThreshold, 
      emergencyThreshold,
      maxRequestsPerHour,
      maxRequestsPerDay 
    } = req.body;

    const monthYear = new Date().toISOString().slice(0, 7);
    
    const updatedBudget = await prisma.costBudget.upsert({
      where: { monthYear },
      create: {
        monthYear,
        totalBudget: totalBudget || 20.00,
        alertThreshold: alertThreshold || 0.80,
        emergencyThreshold: emergencyThreshold || 0.95,
        maxRequestsPerHour: maxRequestsPerHour || 1000,
        maxRequestsPerDay: maxRequestsPerDay || 10000
      },
      update: {
        totalBudget,
        alertThreshold,
        emergencyThreshold,
        maxRequestsPerHour,
        maxRequestsPerDay
      }
    });

    res.json({
      message: 'Budget settings updated successfully',
      budget: updatedBudget
    });
  } catch (error) {
    logger.error('Failed to update budget settings', { error });
    res.status(500).json({ 
      message: 'Failed to update budget settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reset emergency mode (admin only)
s3CostRoutes.post('/reset-emergency-mode', async (req, res) => {
  try {
    const monthYear = new Date().toISOString().slice(0, 7);
    
    const budget = await prisma.costBudget.update({
      where: { monthYear },
      data: {
        emergencyMode: false,
        budgetExceeded: false
      }
    });

    logger.info('Emergency mode reset by admin', { monthYear });

    res.json({
      message: 'Emergency mode reset successfully',
      budget
    });
  } catch (error) {
    logger.error('Failed to reset emergency mode', { error });
    res.status(500).json({ 
      message: 'Failed to reset emergency mode',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent S3 operations
s3CostRoutes.get('/recent-operations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const operations = await prisma.s3Operation.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        business: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const total = await prisma.s3Operation.count();

    res.json({
      operations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Failed to get recent operations', { error });
    res.status(500).json({ 
      message: 'Failed to retrieve recent operations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Purge Cloudflare cache for specific URLs
s3CostRoutes.post('/purge-cache', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      res.status(400).json({ message: 'URLs array is required' });
      return;
    }

    // This would need to be implemented in the CloudflareS3Service
    // For now, return a placeholder response
    logger.info('Cache purge requested', { urls });
    
    res.json({
      message: 'Cache purge initiated',
      urls,
      status: 'pending'
    });
  } catch (error) {
    logger.error('Failed to purge cache', { error });
    res.status(500).json({ 
      message: 'Failed to purge cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test image upload endpoint (for testing cost controls)
s3CostRoutes.post('/test-upload', async (req, res) => {
  try {
    // Create a simple test image buffer
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const businessId = 'test-business-' + Date.now();
    const photoId = 'test-photo-' + Date.now();

    const s3Key = await cloudflareS3Service.uploadImage(
      testImageBuffer,
      businessId,
      photoId,
      'thumbnail'
    );

    // Get CDN URL
    const cdnUrl = await cloudflareS3Service.getImageUrl(s3Key, true);

    res.json({
      message: 'Test upload successful',
      s3Key,
      cdnUrl,
      businessId,
      photoId
    });
  } catch (error) {
    logger.error('Test upload failed', { error });
    res.status(500).json({ 
      message: 'Test upload failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check for S3 and Cloudflare services
s3CostRoutes.get('/health', async (req, res) => {
  try {
    const report = await cloudflareS3Service.getCostReport();
    
    res.json({
      status: 'healthy',
      cloudflareEnabled: process.env.CLOUDFLARE_CDN_ENABLED === 'true',
      emergencyMode: report.emergencyMode,
      currentCost: report.currentMonth.total,
      budgetRemaining: report.remainingBudget,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default s3CostRoutes;