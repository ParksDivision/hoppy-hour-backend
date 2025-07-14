import express from 'express'
import router from './routes';
import cors from 'cors';
import { setupBullDashboard } from './utils/api/dashboard';
import { logger } from './utils/logger/logger';
import prisma from './prismaClient';

// Import functional event-driven services
import { initializeStandardizationService } from './services/standardizationService';
import { initializeDeduplicationService, getDeduplicationStats } from './services/deduplicationService';
import { initializePhotoProcessingService } from './services/photoProcessingService';
import { subscribeToEvent } from './events/eventBus';
import { getEventStats, isEventSystemHealthy } from './events/eventBus';

const app = express();

// Security middleware
app.use((req, res, next) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins: (string | RegExp)[] = [
      'http://localhost:3000',          // Local development
      'http://localhost:3001',          // Local backend
      'https://localhost:3000',         // Local HTTPS
      process.env.FRONTEND_URL,         // Production frontend
      process.env.ADMIN_URL,            // Admin panel if different
    ].filter(Boolean) as (string | RegExp)[]; // Remove undefined values

    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push(
        /^http:\/\/localhost:\d+$/,     // Any localhost port
        /^https:\/\/localhost:\d+$/,    // Any localhost HTTPS port
        /^http:\/\/127\.0\.0\.1:\d+$/,  // 127.0.0.1 variants
        /^https:\/\/127\.0\.0\.1:\d+$/, 
      );
    }

    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS: Origin not allowed');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Forwarded-For'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page'
  ],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming requests
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin')
  }, 'Incoming request');

  // Log response when request completes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      contentLength: res.get('Content-Length')
    }, 'Request completed');
  });

  next();
});

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    (req as any).rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Rate limiting middleware (basic implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }

    const current = rateLimitStore.get(ip) || { count: 0, resetTime: now + windowMs };
    
    if (current.resetTime < now) {
      // Reset window
      current.count = 1;
      current.resetTime = now + windowMs;
    } else {
      current.count++;
    }

    rateLimitStore.set(ip, current);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000));

    if (current.count > maxRequests) {
      logger.warn({ ip, count: current.count }, 'Rate limit exceeded');
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later.',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
      return;
    }

    next();
  };
};

// Apply rate limiting globally (more permissive in development)
const globalRateLimit = process.env.NODE_ENV === 'production' 
  ? rateLimit(100, 15 * 60 * 1000)  // 100 requests per 15 minutes in production
  : rateLimit(1000, 15 * 60 * 1000); // 1000 requests per 15 minutes in development

app.use(globalRateLimit);

// API routes with additional rate limiting for specific endpoints
app.use('/', router);

// Setup Bull dashboard with authentication
setupBullDashboard(app);

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    err: error,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  }, 'Unhandled request error');

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: error.status < 500 ? error.message : 'Internal Server Error',
    ...(isDevelopment && { 
      stack: error.stack,
      details: error.details 
    }),
    timestamp: new Date().toISOString(),
    requestId: req.get('X-Request-ID') || 'unknown'
  });
});

// Initialize Event-Driven Architecture
const initializeEventSystem = async () => {
  try {
    logger.info('Initializing enhanced event-driven business processing system...');

    // Initialize core services
    logger.info('Initializing standardization service...');
    initializeStandardizationService();
    
    logger.info('Initializing deduplication service...');
    initializeDeduplicationService();

    logger.info('Initializing photo processing service...');
    initializePhotoProcessingService();
    
    // Set up comprehensive event monitoring
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

    subscribeToEvent('business.photos.processed', async (event) => {
      logger.info({
        eventId: event.id,
        businessId: 'businessId' in event.data ? event.data.businessId : undefined,
        photosProcessed: 'photosProcessed' in event.data ? event.data.photosProcessed : undefined,
        mainPhotoSet: 'mainPhotoSet' in event.data ? event.data.mainPhotoSet : undefined,
        hasS3Storage: 'hasS3Storage' in event.data ? event.data.hasS3Storage : undefined
      }, 'Business photos successfully processed');
    });

    logger.info('Enhanced event-driven system initialized successfully');
    logger.info('Current flow: Raw Collection → Standardization → Deduplication → Photo Processing');
    
    return {
      standardizationInitialized: true,
      deduplicationInitialized: true,
      dealProcessingInitialized: false, // PAUSED
      photoProcessingInitialized: true
    };

  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize enhanced event-driven system');
    throw error;
  }
};

// Initialize the event system on startup
initializeEventSystem().catch(error => {
  logger.error({ err: error }, 'Critical error during event system initialization');
  process.exit(1);
});

// Enhanced health check endpoints
app.get('/health', async (req, res) => {
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      service: 'hoppy-hour-backend',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'unknown',
      eventSystem: 'unknown'
    };

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = 'connected';
    } catch (dbError) {
      health.database = 'disconnected';
      logger.error({ err: dbError }, 'Database health check failed');
    }

    // Test event system
    health.eventSystem = isEventSystemHealthy() ? 'operational' : 'error';

    const overallHealthy = health.database === 'connected' && health.eventSystem === 'operational';
    
    res.status(overallHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/health/detailed', async (req, res) => {
  try {
    const eventStats = getEventStats();
    const deduplicationStats = await getDeduplicationStats();
    
    const totalBusinesses = await prisma.business.count();
    const businessesWithPhotos = await prisma.business.count({
      where: { photos: { some: {} } }
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
      },
      database: {
        totalBusinesses,
        businessesWithPhotos,
        photoCoverage: totalBusinesses > 0 ? (businessesWithPhotos / totalBusinesses * 100).toFixed(1) : 0
      },
      eventSystem: {
        healthy: isEventSystemHealthy(),
        totalEvents: eventStats.totalEvents,
        listenerStats: eventStats.listenerStats,
        recentEvents: eventStats.recentEvents
      },
      deduplication: deduplicationStats,
      services: {
        standardization: 'operational',
        deduplication: 'operational',
        photoProcessing: 'operational',
        dealProcessing: 'paused'
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Detailed health check failed');
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;
  
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...');
  isShuttingDown = true;

  // Stop accepting new requests
  app.use((req, res) => {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server is shutting down'
    });
  });

  // Close database connections
  prisma.$disconnect()
    .then(() => logger.info('Database connections closed'))
    .catch(err => logger.error({ err }, 'Error closing database connections'))
    .finally(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Force shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  gracefulShutdown('unhandledRejection');
});

export default app;