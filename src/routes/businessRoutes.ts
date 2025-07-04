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
  getBusinessStats
} from '../controllers/businessController';

const businessRoutes = Router();

// Fixed: Remove parentheses - pass function references, not function calls
businessRoutes.get('/:id', getOneBusiness);
businessRoutes.get('/', getManyBusinesses);
businessRoutes.get('/:businessId/photos', getBusinessPhotos);

// Location-based search
businessRoutes.get('/search/location', searchBusinessesByLocation);

// Category-based search
businessRoutes.get('/search/category/:category', getBusinessesByCategory);

// Business statistics
businessRoutes.get('/admin/stats', getBusinessStats);

// Use different routes for single and many creation to avoid conflicts
businessRoutes.post('/many', createManyBusinesses);
businessRoutes.post('/', createBusiness);

businessRoutes.put('/update/:id', updateBusiness);
businessRoutes.put('/update', updateManyBusinesses);

businessRoutes.delete('/delete/:id', deleteBusiness);
businessRoutes.delete('/delete', deleteManyBusinesses);

export default businessRoutes;