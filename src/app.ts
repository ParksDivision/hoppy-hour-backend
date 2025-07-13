import express from 'express'
import router from './routes';
import cors from 'cors';
import { setupBullDashboard } from './utils/api/dashboard';
import { logger } from './utils/logger/logger';
import prisma from './prismaClient';

// Import functional event-driven services
import { initializeStandardizationService } from './services/standardizationService';
import { initializeDeduplicationService, getDeduplicationStats } from './services/deduplicationService';
import { initializeDealProcessingService } from './services/dealProcessingService';
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
    logger.info('Initializing deals-first event-driven business processing system...');

    // Initialize functional services in UPDATED order (deals before photos)
    logger.info('Initializing standardization service...');
    initializeStandardizationService();
    
    logger.info('Initializing deduplication service...');
    initializeDeduplicationService();

    logger.info('Initializing deal processing service...');
    initializeDealProcessingService();

    logger.info('Initializing photo processing service (deals-driven)...');
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
      }, 'Business successfully processed through deduplication pipeline');
    });

    // NEW: Monitor deal processing events
    subscribeToEvent('business.deals.processed', async (event) => {
      logger.info({
        eventId: event.id,
        businessId: 'businessId' in event.data ? event.data.businessId : undefined,
        hasDeals: 'hasActiveDeals' in event.data ? event.data.hasActiveDeals : undefined,
        dealsCount: 'dealsExtracted' in event.data ? event.data.dealsExtracted : undefined
      }, 'Deal processing completed');
    });

    // Monitor photo processing events
    subscribeToEvent('business.photos.processed', async (event) => {
      logger.info({
        eventId: event.id,
        businessId: 'businessId' in event.data ? event.data.businessId : undefined,
        photosProcessed: 'photosProcessed' in event.data ? event.data.photosProcessed : undefined,
        mainPhotoSet: 'mainPhotoSet' in event.data ? event.data.mainPhotoSet : undefined,
        hasS3Storage: 'hasS3Storage' in event.data ? event.data.hasS3Storage : undefined
      }, 'Business photos successfully processed');
    });

    logger.info('Deals-first event-driven system initialized successfully');
    
    return {
      standardizationInitialized: true,
      deduplicationInitialized: true,
      dealProcessingInitialized: true,
      photoProcessingInitialized: true
    };

  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize deals-first event-driven system');
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
      architecture: 'deals-first-functional',
      services: {
        standardization: 'operational',
        deduplication: 'operational',
        dealProcessing: 'operational',
        photoProcessing: 'operational (deals-driven)'
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

// Deal processing stats endpoint
app.get('/admin/deal-processing/stats', async (req, res) => {
  try {
    const totalBusinesses = await prisma.business.count();
    
    const businessesWithDeals = await prisma.business.count({
      where: {
        deals: {
          some: { isActive: true }
        }
      }
    });

    const totalActiveDeals = await prisma.deal.count({
      where: { isActive: true }
    });

    // Deals by day of week
    const dealsByDay = await prisma.deal.groupBy({
      by: ['dayOfWeek'],
      where: { isActive: true },
      _count: true
    });

    const dealsByDayFormatted = dealsByDay.reduce((acc, item) => {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][item.dayOfWeek || 0];
      acc[dayName] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      totalBusinesses,
      businessesWithDeals,
      businessesWithoutDeals: totalBusinesses - businessesWithDeals,
      dealCoverage: totalBusinesses > 0 ? (businessesWithDeals / totalBusinesses * 100).toFixed(1) : 0,
      totalActiveDeals,
      averageDealsPerBusiness: businessesWithDeals > 0 ? (totalActiveDeals / businessesWithDeals).toFixed(1) : 0,
      dealsByDay: dealsByDayFormatted
    };

    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get deal processing stats');
    res.status(500).json({
      error: 'Failed to retrieve deal processing statistics'
    });
  }
});

// Photo processing stats endpoint (now for businesses with deals only)
app.get('/admin/photo-processing/stats', async (req, res) => {
  try {
    const businessesWithDeals = await prisma.business.count({
      where: {
        deals: {
          some: { isActive: true }
        }
      }
    });
    
    const businessesWithDealsAndPhotos = await prisma.business.count({
      where: {
        AND: [
          {
            deals: {
              some: { isActive: true }
            }
          },
          {
            photos: {
              some: {}
            }
          }
        ]
      }
    });
    
    const totalPhotos = await prisma.photo.count({
      where: {
        business: {
          deals: {
            some: { isActive: true }
          }
        }
      }
    });
    
    const photosWithS3 = await prisma.photo.count({
      where: {
        AND: [
          { s3Key: { not: null } },
          {
            business: {
              deals: {
                some: { isActive: true }
              }
            }
          }
        ]
      }
    });

    const stats = {
      businessesWithDeals,
      businessesWithDealsAndPhotos,
      businessesWithDealsButNoPhotos: businessesWithDeals - businessesWithDealsAndPhotos,
      totalPhotos,
      photosWithS3Storage: photosWithS3,
      photosExternalOnly: totalPhotos - photosWithS3,
      photoCoverage: businessesWithDeals > 0 ? (businessesWithDealsAndPhotos / businessesWithDeals * 100).toFixed(1) : 0,
      note: "Statistics for businesses with active deals only"
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
      timestamp: new Date().toISOString(),
      note: 'Deals-first pipeline: Raw → Standard → Dedupe → Deals → Photos (only for businesses with deals)'
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger manual update');
    res.status(500).json({
      error: 'Failed to trigger manual update'
    });
  }
});

// Test endpoint to verify event system
app.post('/admin/test-events', async (req, res) => {
  try {
    const { publishEvent } = await import('./events/eventBus');
    const { v4: uuidv4 } = await import('uuid');
    
    // Create a test event with deals in operating hours
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
          displayName: { text: 'Test Happy Hour Bar' },
          formattedAddress: '123 Test St, Austin, TX',
          location: { latitude: 30.2672, longitude: -97.7431 },
          types: ['bar', 'restaurant'],
          regularOpeningHours: {
            weekdayDescriptions: [
              'Monday: 4:00 PM – 2:00 AM, Happy Hour 4:00 PM – 7:00 PM',
              'Tuesday: 4:00 PM – 2:00 AM, $5 beer specials 5:00 PM – 8:00 PM',
              'Wednesday: 4:00 PM – 2:00 AM, Half price cocktails 6:00 PM – 9:00 PM'
            ]
          },
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
      message: 'Test event with deals published successfully - should trigger full pipeline',
      eventId: testEvent.id,
      expectedFlow: 'Raw → Standardize → Dedupe → Extract Deals → Process Photos (if deals found)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to publish test event');
    res.status(500).json({
      error: 'Failed to publish test event'
    });
  }
});

export default app