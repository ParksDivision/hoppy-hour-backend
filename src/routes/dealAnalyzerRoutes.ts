import { Router } from 'express';
import {
  analyzeBusinessDeals,
  analyzePendingBusinesses,
  analyzeAllBusinesses,
  getBusinessDeals,
  getAggregatedBusinessDeals,
  getDealStats,
  getDealQueueStats,
  getPendingDeals,
  publishPendingDeal,
  getProductionDeals,
  getProductionDealByBusiness,
} from '../controllers/data-collection/dealAnalyzerController';

const router = Router();

// Analysis triggers
router.post('/analyze', analyzeBusinessDeals);
router.post('/analyze/pending', analyzePendingBusinesses);
router.post('/analyze/all', analyzeAllBusinesses);

// Pending deals (admin review + publish workflow)
router.get('/pending', getPendingDeals);
router.patch('/pending/:businessId/publish', publishPendingDeal);

// Production deals (frontend)
router.get('/production', getProductionDeals);
router.get('/production/:businessId', getProductionDealByBusiness);

// Stats
router.get('/stats', getDealStats);
router.get('/queue/stats', getDealQueueStats);

// Raw analysis queries (must be after static routes to avoid param conflicts)
router.get('/:businessId/aggregated', getAggregatedBusinessDeals);
router.get('/:businessId', getBusinessDeals);

export { router as dealAnalyzerRoutes };
