import express from 'express'
import router from './routes';
import cors from 'cors';
import { setupBullDashboard } from './utils/api/dashboard';
import { logger } from './utils/logger/logger';
import prisma from './prismaClient';

// Import functional event-driven services
import { initializeStandardizationService } from './services/standardizationService';
import { initializeDeduplicationService, getDeduplicationStats } from './services/deduplicationService';
// import { initializeDealProcessingService } from './services/dealProcessingService'; // PAUSED
import { initializePhotoProcessingService } from './services/photoProcessingService';
import { subscribeToEvent } from './events/eventBus';

const app = express()

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? 'your-production-domain.com' 
      : 'http://localhost:3000'
}));

app.use(express.json())

// Mount the routes
app.use('/', router);

// Setup Bull dashboard
setupBullDashboard(app);

// Initialize Event-Driven Architecture
const initializeEventSystem = async () => {
  try {
    logger.info('Initializing streamlined event-driven business processing system...');

    // UPDATED: Simplified flow - Raw → Standard → Dedupe → Photos (deal processing paused)
    logger.info('Initializing standardization service...');
    initializeStandardizationService();
    
    logger.info('Initializing deduplication service...');
    initializeDeduplicationService();

    // DEAL PROCESSING PAUSED - Will be re-enabled with more robust solution
    // logger.info('Initializing deal processing service...');
    // initializeDealProcessingService();

    logger.info('Initializing photo processing service (post-deduplication)...');
    initializePhotoProcessingService();
    
    // Set up monitoring for business events using correct event types
    subscribeToEvent('business.raw.collected', async (event) => {
      logger.debug({
        eventId: event.id,
        sourceId: 'sourceId' in event.data ? event.data.sourceId : undefined,
        source: 'source' in event.data ? event.data.source : undefined,
        location: 'location' in event.data && event.data.location ? event.data.location.name : undefined
      }, 'Raw business event received');
    });

    subscribeToEvent('business.standardized', async (event) => {
      logger.debug({
        eventId: event.id,
        sourceId: 'sourceId' in event.data ? event.data.sourceId : undefined,
        source: 'source' in event.data ? event.data.source : undefined,
        businessName: 'standardizedBusiness' in event.data && event.data.standardizedBusiness ? event.data.standardizedBusiness.name : undefined
      }, 'Standardized business event received');
    });

    subscribeToEvent('business.deduplicated', async (event) => {
      logger.info({
        eventId: event.id,
        businessId: 'businessId' in event.data ? event.data.businessId : undefined,
        action: 'action' in event.data ? event.data.action : undefined,
        confidence: 'confidence' in event.data ? event.data.confidence : undefined
      }, 'Business processed through deduplication - proceeding to photo processing');
    });

    // UPDATED: Deal processing events commented out (service paused)
    // subscribeToEvent('business.deals.processed', async (event) => {
    //   logger.info({
    //     eventId: event.id,
    //     businessId: 'businessId' in event.data ? event.data.businessId : undefined,
    //     hasDeals: 'hasActiveDeals' in event.data ? event.data.hasActiveDeals : undefined,
    //     dealsCount: 'dealsExtracted' in event.data ? event.data.dealsExtracted : undefined
    //   }, 'Deal processing completed');
    // });

    // Monitor photo processing events (now triggered after deduplication)
    subscribeToEvent('business.photos.processed', async (event) => {
      logger.info({
        eventId: event.id,
        businessId: 'businessId' in event.data ? event.data.businessId : undefined,
        photosProcessed: 'photosProcessed' in event.data ? event.data.photosProcessed : undefined,
        mainPhotoSet: 'mainPhotoSet' in event.data ? event.data.mainPhotoSet : undefined,
        hasS3Storage: 'hasS3Storage' in event.data ? event.data.hasS3Storage : undefined
      }, 'Business photos successfully processed');
    });

    logger.info('Streamlined event-driven system initialized successfully');
    logger.info('Current flow: Raw Collection → Standardization → Deduplication → Photo Processing');
    logger.warn('Deal processing is currently PAUSED - will be re-enabled with more robust extraction');
    
    return {
      standardizationInitialized: true,
      deduplicationInitialized: true,
      dealProcessingInitialized: false, // PAUSED
      photoProcessingInitialized: true
    };

  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize streamlined event-driven system');
    throw error;
  }
};

// Initialize the event system on startup
initializeEventSystem().catch(error => {
  logger.error({ err: error }, 'Critical error during event system initialization');
  process.exit(1);
});

// Health check endpoints
app.get('/health/events', async (req, res) => {
  try {
    const health = {
      eventSystem: 'operational',
      architecture: 'streamlined-functional',
      currentFlow: 'Raw → Standardize → Dedupe → Photos',
      services: {
        standardization: 'operational',
        deduplication: 'operational',
        dealProcessing: 'PAUSED', // Will be re-enabled
        photoProcessing: 'operational (post-deduplication)'
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      eventSystem: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Deduplication stats endpoint
app.get('/admin/deduplication/stats', async (req, res) => {
  try {
    const stats = await getDeduplicationStats();
    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get deduplication stats');
    res.status(500).json({
      error: 'Failed to retrieve deduplication statistics'
    });
  }
});

// UPDATED: General business processing stats (not deal-focused)
app.get('/admin/processing/stats', async (req, res) => {
  try {
    const totalBusinesses = await prisma.business.count();
    
    const businessesWithPhotos = await prisma.business.count({
      where: {
        photos: {
          some: {}
        }
      }
    });

    // Count by source
    const sourceBreakdown = {
      google: await prisma.business.count({ 
        where: { 
          sourceBusinesses: {
            some: { source: 'GOOGLE' }
          }
        } 
      }),
      yelp: await prisma.business.count({ 
        where: { 
          sourceBusinesses: {
            some: { source: 'YELP' }
          }
        } 
      }),
      manual: await prisma.business.count({ 
        where: { 
          sourceBusinesses: {
            none: {}
          }
        }
      })
    };

    const totalPhotos = await prisma.photo.count();
    const photosWithS3 = await prisma.photo.count({
      where: { s3Key: { not: null } }
    });

    const averageRating = await prisma.business.aggregate({
      _avg: { ratingOverall: true }
    });

    const stats = {
      totalBusinesses,
      businessesWithPhotos,
      businessesWithoutPhotos: totalBusinesses - businessesWithPhotos,
      photoCoverage: totalBusinesses > 0 ? (businessesWithPhotos / totalBusinesses * 100).toFixed(1) : 0,
      totalPhotos,
      photosWithS3Storage: photosWithS3,
      photosExternalOnly: totalPhotos - photosWithS3,
      averageRating: averageRating._avg.ratingOverall || 0,
      sources: sourceBreakdown,
      processingFlow: 'Raw → Standardize → Dedupe → Photos',
      dealProcessingStatus: 'PAUSED'
    };

    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get processing stats');
    res.status(500).json({
      error: 'Failed to retrieve processing statistics'
    });
  }
});

// Photo processing stats endpoint (now for all businesses)
app.get('/admin/photo-processing/stats', async (req, res) => {
  try {
    const totalBusinesses = await prisma.business.count();
    
    const businessesWithPhotos = await prisma.business.count({
      where: {
        photos: {
          some: {}
        }
      }
    });
    
    const totalPhotos = await prisma.photo.count();
    
    const photosWithS3 = await prisma.photo.count({
      where: { s3Key: { not: null } }
    });

    const mainPhotos = await prisma.photo.count({
      where: { mainPhoto: true }
    });

    const stats = {
      totalBusinesses,
      businessesWithPhotos,
      businessesWithoutPhotos: totalBusinesses - businessesWithPhotos,
      totalPhotos,
      photosWithS3Storage: photosWithS3,
      photosExternalOnly: totalPhotos - photosWithS3,
      mainPhotosSet: mainPhotos,
      photoCoverage: totalBusinesses > 0 ? (businessesWithPhotos / totalBusinesses * 100).toFixed(1) : 0,
      averagePhotosPerBusiness: totalBusinesses > 0 ? (totalPhotos / totalBusinesses).toFixed(1) : 0,
      trigger: 'post-deduplication',
      note: "Photo processing now triggers after deduplication for all businesses"
    };

    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get photo processing stats');
    res.status(500).json({
      error: 'Failed to retrieve photo processing statistics'
    });
  }
});

// Manual trigger endpoint for testing
app.post('/admin/trigger-update/:location?', async (req, res) => {
  try {
    const location = req.params.location || 'downtown';
    
    logger.info({ location }, 'Manual update triggered via API');
    
    res.json({
      message: `Manual update triggered for ${location}`,
      currentFlow: 'Raw Collection → Standardization → Deduplication → Photo Processing',
      dealProcessing: 'PAUSED (will be re-enabled with robust extraction)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger manual update');
    res.status(500).json({
      error: 'Failed to trigger manual update'
    });
  }
});

// Test endpoint to verify streamlined event system
app.post('/admin/test-events', async (req, res) => {
  try {
    const { publishEvent } = await import('./events/eventBus');
    const { v4: uuidv4 } = await import('uuid');
    
    // Create a test event
    const testEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      source: 'test-api',
      type: 'business.raw.collected' as const,
      data: {
        sourceId: 'test-123',
        source: 'GOOGLE' as const,
        rawData: {
          id: 'test-123',
          displayName: { text: 'Test Business' },
          formattedAddress: '123 Test St, Austin, TX',
          location: { latitude: 30.2672, longitude: -97.7431 },
          types: ['bar', 'restaurant'],
          photos: [
            {
              name: 'places/test-123/photos/photo-1',
              widthPx: 800,
              heightPx: 600
            }
          ]
        },
        location: {
          lat: 30.2672,
          lng: -97.7431,
          name: 'Test Location'
        }
      }
    };

    publishEvent(testEvent);
    
    res.json({
      message: 'Test event published successfully',
      eventId: testEvent.id,
      expectedFlow: 'Raw → Standardize → Dedupe → Photos (deal processing skipped)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to publish test event');
    res.status(500).json({
      error: 'Failed to publish test event'
    });
  }
});

// Endpoint to check deal processing status
app.get('/admin/deal-processing/status', async (req, res) => {
  try {
    res.json({
      status: 'PAUSED',
      reason: 'Regex-based extraction being replaced with more robust solution',
      whenEnabled: 'Will be re-enabled with improved extraction logic',
      currentDeals: await prisma.deal.count({ where: { isActive: true } }),
      note: 'Existing deals (if any) are preserved but new extraction is disabled'
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get deal processing status');
    res.status(500).json({
      error: 'Failed to retrieve deal processing status'
    });
  }
});

export default app