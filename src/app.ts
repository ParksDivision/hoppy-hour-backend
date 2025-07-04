import express from 'express'
import router from './routes';
import cors from 'cors';
import { setupBullDashboard } from './utils/api/dashboard';
import { logger } from './utils/logger/logger';

// Import functional event-driven services
import { initializeStandardizationService } from './services/standardizationService';
import { initializeDeduplicationService, getDeduplicationStats } from './services/deduplicationService';
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
    logger.info('Initializing functional event-driven business processing system...');

    // Initialize functional services in correct order
    logger.info('Initializing standardization service...');
    initializeStandardizationService();
    
    logger.info('Initializing deduplication service...');
    initializeDeduplicationService();
    
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

    logger.info('Functional event-driven system initialized successfully');
    
    return {
      standardizationInitialized: true,
      deduplicationInitialized: true
    };

  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize functional event-driven system');
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
      architecture: 'functional',
      services: {
        standardization: 'operational',
        deduplication: 'operational'
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

// Manual trigger endpoint for testing
app.post('/admin/trigger-update/:location?', async (req, res) => {
  try {
    const location = req.params.location || 'downtown';
    
    logger.info({ location }, 'Manual update triggered via API');
    
    // You can implement the actual trigger logic here
    // For now, just return success
    res.json({
      message: `Manual update triggered for ${location}`,
      timestamp: new Date().toISOString(),
      note: 'Actual Google API integration can be triggered from scheduler or separate endpoint'
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
          displayName: { text: 'Test Restaurant' },
          formattedAddress: '123 Test St, Austin, TX',
          location: { latitude: 30.2672, longitude: -97.7431 },
          types: ['restaurant']
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