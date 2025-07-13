import { Router } from 'express';
import { 
  getOneBusiness,
  getManyBusinesses,
  createBusiness,
  createManyBusinesses,
  updateBusiness,
  updateManyBusinesses,
  deleteBusiness,
  deleteManyBusinesses,
  getBusinessPhotos,
  searchBusinessesByLocation,
  getBusinessesByCategory,
  getBusinessStats,
  getBusinessesWithActiveDeals,     // NEW
  getBusinessStatsForDeals          // NEW
} from '../controllers/businessController';

const businessRoutes = Router();

// NEW: Primary frontend endpoint - businesses with current active deals
businessRoutes.get('/with-deals', getBusinessesWithActiveDeals);

// NEW: Deal-focused statistics
businessRoutes.get('/stats/deals', getBusinessStatsForDeals);

// Existing endpoints
businessRoutes.get('/:id', getOneBusiness);
businessRoutes.get('/:businessId/photos', getBusinessPhotos);

// Location-based search
businessRoutes.get('/search/location', searchBusinessesByLocation);

// Category-based search
businessRoutes.get('/search/category/:category', getBusinessesByCategory);

// Business statistics (general)
businessRoutes.get('/admin/stats', getBusinessStats);

// UPDATED: Now filters by deals by default, unless includeWithoutDeals=true
businessRoutes.get('/', getManyBusinesses);

// Use different routes for single and many creation to avoid conflicts
businessRoutes.post('/many', createManyBusinesses);
businessRoutes.post('/', createBusiness);

businessRoutes.put('/update/:id', updateBusiness);
businessRoutes.put('/update', updateManyBusinesses);

businessRoutes.delete('/delete/:id', deleteBusiness);
businessRoutes.delete('/delete', deleteManyBusinesses);

export default businessRoutes;