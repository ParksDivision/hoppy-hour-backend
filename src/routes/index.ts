import { Router } from 'express'
import userRoutes from '../routes/userRoutes'
import businessRoutes from '../routes/businessRoutes'
import yelpRoutes from './yelpRoutes';
import imageRoutes from './imageRoutes';
import s3CostRoutes from './s3CostRoutes'; // New import

const router = Router();

// Route for user-related APIs
router.use('api/users', userRoutes)

// Route for business-related APIs
router.use('api/business', businessRoutes)
router.use('/business', businessRoutes)

// Route for Yelp API data intake
router.use('/yelp', yelpRoutes)

// Image S3 retrieval (legacy - for backwards compatibility)
router.use('/images', imageRoutes);

// S3 Cost monitoring and management routes
router.use('/api/s3', s3CostRoutes);

export default router;