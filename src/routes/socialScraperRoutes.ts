import { Router } from 'express';
import {
  scrapeBusinessSocialLinks,
  scrapePendingBusinesses,
  getBusinessSocialLinks,
  getSocialScrapingStats,
  getSocialQueueStats,
} from '../controllers/data-collection/socialScraperController';

const router = Router();

// Scrape triggers
router.post('/scrape', scrapeBusinessSocialLinks);
router.post('/scrape/pending', scrapePendingBusinesses);

// Query endpoints
router.get('/links/:businessId', getBusinessSocialLinks);
router.get('/stats', getSocialScrapingStats);

// Queue stats
router.get('/queue/stats', getSocialQueueStats);

export { router as socialScraperRoutes };
