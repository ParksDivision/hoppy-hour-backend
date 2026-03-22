import { Router } from 'express';
import {
  analyzeBusinessDeals,
  analyzePendingBusinesses,
  getBusinessDeals,
  getDealStats,
  getDealQueueStats,
} from '../controllers/data-collection/dealAnalyzerController';

const router = Router();

// Analysis triggers
router.post('/analyze', analyzeBusinessDeals);
router.post('/analyze/pending', analyzePendingBusinesses);

// Query endpoints
router.get('/stats', getDealStats);
router.get('/queue/stats', getDealQueueStats);
router.get('/:businessId', getBusinessDeals);

export { router as dealAnalyzerRoutes };
