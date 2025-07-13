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
  getBusinessesWithActiveDeals,     // Still available but may return empty
  getBusinessStatsForDeals          // Updated to show deal processing status
} from '../controllers/businessController';

const businessRoutes = Router();

// PRIMARY ENDPOINT: All processed businesses (default behavior)
// This now shows all businesses after deduplication and photo processing
businessRoutes.get('/', getManyBusinesses);

// Individual business
businessRoutes.get('/:id', getOneBusiness);

// Business photos
businessRoutes.get('/:businessId/photos', getBusinessPhotos);

// SEARCH ENDPOINTS
// Location-based search (all businesses by default)
businessRoutes.get('/search/location', searchBusinessesByLocation);

// Category-based search (all businesses by default)  
businessRoutes.get('/search/category/:category', getBusinessesByCategory);

// DEAL-RELATED ENDPOINTS (May return empty while deal processing is paused)
// Businesses with active deals (will be empty until deal processing resumes)
businessRoutes.get('/with-deals', getBusinessesWithActiveDeals);

// STATISTICS ENDPOINTS
// General business statistics
businessRoutes.get('/admin/stats', getBusinessStats);

// Deal-focused statistics (shows deal processing status)
businessRoutes.get('/stats/deals', getBusinessStatsForDeals);

// CRUD OPERATIONS
// Use different routes for single and many creation to avoid conflicts
businessRoutes.post('/many', createManyBusinesses);
businessRoutes.post('/', createBusiness);

businessRoutes.put('/update/:id', updateBusiness);
businessRoutes.put('/update', updateManyBusinesses);

businessRoutes.delete('/delete/:id', deleteBusiness);
businessRoutes.delete('/delete', deleteManyBusinesses);

export default businessRoutes;