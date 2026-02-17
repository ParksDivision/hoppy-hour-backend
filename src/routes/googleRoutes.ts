/**
 * Google Places Data Collection Routes
 */

import { Router } from 'express';
import {
  searchNearbyPlaces,
  bulkSearchNearbyPlaces,
  searchCityBusinesses,
  getCollectedBusinesses,
  getCollectedBusinessById,
  searchCollectedBusinessesByName,
  getGoogleQueueStats,
} from '../controllers/data-collection/googleController';

const router = Router();

// Search endpoints (trigger background jobs)
router.post('/search', searchNearbyPlaces);
router.post('/search/bulk', bulkSearchNearbyPlaces);
router.post('/search/city', searchCityBusinesses);

// Query endpoints
router.get('/businesses', getCollectedBusinesses);
router.get('/businesses/search/name', searchCollectedBusinessesByName);
router.get('/businesses/:id', getCollectedBusinessById);

// Queue stats
router.get('/queue/stats', getGoogleQueueStats);

export { router as googleRoutes };
