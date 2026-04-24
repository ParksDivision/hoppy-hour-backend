import { Request, Response } from 'express';
import { getPhoto } from '../../services/photoCache/service';
import prisma from '../../utils/database';
import { logger } from '../../utils/logger';

/**
 * GET /api/photos/:placeId/:photoIndex
 * Serves a cached business photo. Fetches from Google and caches on first request.
 */
export const getBusinessPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const placeId = req.params.placeId;
    const index = parseInt(req.params.photoIndex ?? '', 10);

    if (!placeId || isNaN(index) || index < 0 || index > 9) {
      res.status(400).json({ error: 'Invalid placeId or photoIndex (0-9)' });
      return;
    }

    // Look up the photo reference from the business data
    const business = await prisma.googleRawBusiness.findUnique({
      where: { googlePlaceId: placeId },
      select: { data: true },
    });

    if (!business?.data) {
      res.status(404).json({ error: 'Business not found' });
      return;
    }

    const gData = business.data as { place?: { photos?: Array<{ name: string }> } };
    const photos = gData.place?.photos ?? [];

    if (index >= photos.length) {
      res.status(404).json({ error: 'Photo index out of range' });
      return;
    }

    const photoName = photos[index]!.name;

    // Get from R2 cache or fetch from Google
    const { body, contentType } = await getPhoto(photoName, placeId, index);

    // Long cache headers — photos don't change often
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': body.length.toString(),
    });

    res.send(body);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ error: msg, placeId: req.params.placeId, photoIndex: req.params.photoIndex }, 'Failed to serve photo');
    res.status(500).json({ error: 'Failed to load photo' });
  }
};
