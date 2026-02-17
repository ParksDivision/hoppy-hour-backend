import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { shutdown } from './queues';
import { logger } from './utils/logger';

// Load environment variables first
dotenv.config();

const app = express();
const port = process.env.PORT ?? 3001;

// ============================================
// Middleware Configuration
// ============================================
const corsOptions = {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP',
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// API Routes - Import BEFORE generating OpenAPI
// ============================================
import { userRoutes } from './routes/userRoutes';
import { googleRoutes } from './routes/googleRoutes';
// import { businessRoutes } from './routes/businessRoutes';

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/data-collection/google', googleRoutes);
// app.use('/api/businesses', businessRoutes);

// ============================================
// OpenAPI/Swagger Documentation
// ============================================
import { generateOpenAPIDocument } from './config/openapi.generator';
import prisma from './utils/database';

// Generate OpenAPI document after routes are registered
const openAPIDocument = generateOpenAPIDocument();

// Serve Swagger UI at /swagger
app.use(
  '/swagger',
  swaggerUi.serve,
  swaggerUi.setup(openAPIDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Hoppy Hour API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      filter: true,
      deepLinking: true,
    },
  })
);

// Serve raw OpenAPI JSON
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openAPIDocument);
});

// ============================================
// Error Handlers
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

app.use((error: Error, req: express.Request, res: express.Response) => {
  logger.error(
    {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      request: {
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query,
        params: req.params,
      },
    },
    'Unhandled error'
  );

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'Internal server error',
      requestId: req.id, // if using request ID middleware
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: error.stack,
    });
  }
});

// ============================================
// Server Initialization
// ============================================
const initializeServer = async () => {
  try {
    // Can add more initialization logic here if needed
    logger.info('Initializing server...');

    // Test database connection if needed
    await prisma.$connect();
    logger.info('Database connected');

    logger.info('BullMQ queue system ready');

    // Log available endpoints
    logger.info(
      {
        endpoints: {
          health: `http://localhost:${port}/health`,
          apiDocs: `http://localhost:${port}/api-docs`,
          openAPI: `http://localhost:${port}/openapi.json`,
        },
      },
      'Server endpoints'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to initialize server');
    process.exit(1);
  }
};

// ============================================
// Graceful Shutdown
// ============================================
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Shutdown queues
    await shutdown();

    // Close database connections if needed
    // await prisma.$disconnect();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// Start Server
// ============================================
const server = app.listen(port, () => {
  logger.info(`🚀 Server running on port ${port}`);
  logger.info(`📚 API Documentation: http://localhost:${port}/api-docs`);
  logger.info(`📋 OpenAPI Spec: http://localhost:${port}/openapi.json`);
  logger.info('✅ BullMQ queue system ready');

  if (process.env.NODE_ENV === 'development') {
    logger.info('🔧 Running in development mode');
  }
});

// Initialize server components
void initializeServer();

export default app;


