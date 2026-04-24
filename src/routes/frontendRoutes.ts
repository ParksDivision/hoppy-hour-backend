import { Router } from 'express';
import { getAustinDeals } from '../controllers/frontend/dealsController';
import { getBusinessPhoto } from '../controllers/frontend/photosController';

const router = Router();

router.get('/austin', getAustinDeals);

export { router as frontendRoutes };

// Photo proxy — mounted separately at /api/photos
const photoRouter = Router();

photoRouter.get('/:placeId/:photoIndex', getBusinessPhoto);

export { photoRouter as photoRoutes };
