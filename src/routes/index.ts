import { Router } from 'express'
import userRoutes from '../routes/userRoutes'
import businessRoutes from '../routes/businessRoutes'
import yelpRoutes from './yelpRoutes';

const router = Router();

// Route for user-related APIs
router.use('/users', userRoutes)

// Route for business-related APIs
router.use('/business', businessRoutes)

// Route for Yelp API data intake
router.use('/yelp', yelpRoutes)

export default router;