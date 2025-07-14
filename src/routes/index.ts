import { Router } from 'express'
import userRoutes from '../routes/userRoutes'
import businessRoutes from '../routes/businessRoutes'
import yelpRoutes from './yelpRoutes';
import imageRoutes from './imageRoutes';
import s3CostRoutes from './s3CostRoutes';

const router = Router();

// CRITICAL: Add health check endpoint at root level for testing
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'hoppy-hour-backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes - These will be accessible as /api/* due to Next.js rewrite
router.use('/api/users', userRoutes);
router.use('/api/business', businessRoutes);
router.use('/api/yelp', yelpRoutes);
router.use('/api/images', imageRoutes);
router.use('/api/s3', s3CostRoutes);

// Direct routes (for direct backend access)
router.use('/users', userRoutes);
router.use('/business', businessRoutes);
router.use('/yelp', yelpRoutes);
router.use('/images', imageRoutes);
router.use('/s3', s3CostRoutes);

// Add CORS preflight handling for all routes
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.sendStatus(200);
});

export default router;