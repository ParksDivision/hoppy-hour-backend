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
  getBusinessPhotos
} from '../controllers/businessController'

const businessRoutes = Router();

businessRoutes.get('/:id', getOneBusiness);
businessRoutes.get('/', getManyBusinesses);
businessRoutes.get('/:businessId/photos', getBusinessPhotos);
businessRoutes.post('/', createBusiness);
businessRoutes.post('/', createManyBusinesses);
businessRoutes.put('/update/:id', updateBusiness);
businessRoutes.put('/update', updateManyBusinesses);
businessRoutes.delete('/delete/:id', deleteBusiness);
businessRoutes.delete('/delete', deleteManyBusinesses);

export default businessRoutes;
