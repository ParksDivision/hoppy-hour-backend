import { Request, Response } from 'express';
import {
    getManyBusinessService, 
    createBusinessService, 
    createManyBusinessService, 
    updateOneBusinessService, 
    updateManyBusinessService,
    deleteOneBusinessService,
    deleteManyBusinessService,
    getOneBusinessService
} from '../services/businessService';
import prisma from '../prismaClient';
import { getImageUrl } from '../utils/enhancedS3Service';

export const getOneBusiness = async (req: Request, res: Response) => {
    try {
        const business = await getOneBusinessService(req.body);

        if (!business) {
            res.status(404).json({ message: "Business not found." });
          }
        res.status(200).json(business);
    } catch (error) {
        console.error("Error fetching business:");
        res.status(500).json({message: "Error fetching business."})
    }
  };


export const getManyBusinesses = async (req: Request, res: Response) => {
  try {
    const businesses = await getManyBusinessService(req.body);
  
    if (!businesses) {
      res.status(404).json({ message: "Businesses not found." });
    }
    res.json(businesses);
  } catch (error) {
      console.error("Error fetching businesses:", error);
      res.status(500).json({message: "Error fetching businesses."})
  }
};


export const createBusiness = async (req: Request, res: Response) => {
  try {
    const business = await createBusinessService(req.body);

    if (!business) {
      res.status(404).json({ message: "Business not created." });
    }
    res.status(201).json(business);
  } catch (error) {
      console.error("Error creating business:", error);
      res.status(500).json({message: "Error creating business:"})
  }
};

export const createManyBusinesses = async (req: Request, res: Response) => {
  try {
    const businesses = await createManyBusinessService(req.body);
  
    if (!businesses) {
      res.status(404).json({ message: "Businesseses not created." });
    }
    res.status(201).json(businesses);
    } catch (error) {
      console.error("Error creating businesses:", error);
      res.status(500).json({message: "Error creating businesses."})
    }
};

export const updateBusiness = async (req: Request, res: Response) => {
  try {
    const updatedBusiness = await updateOneBusinessService(req.body)

    if (!updatedBusiness) {
      res.status(404).json({ message: "Business not updated." });
    }
    res.status(201).json(updatedBusiness);
  } catch (error) {
    console.error("Error updating business:", error);
    res.status(500).json({message: "Error updating business."})
  }
};

export const updateManyBusinesses = async (req: Request, res: Response) => {
    try {
      const updatedBusinesses = await updateManyBusinessService(req.body)
  
      if (!updatedBusinesses) {
        res.status(404).json({ message: "Businesses not updated." });
      }
      res.status(201).json(updatedBusinesses);
    } catch (error) {
      console.error("Error updating businesses:", error);
      res.status(500).json({message: "Error updating businesses."})
    }
  };

export const deleteBusiness = async (req: Request, res: Response) => {
    try {
        const deletedBusiness = await deleteOneBusinessService(req.body)

        if (!deletedBusiness) {
            res.status(404).json({message: "Business not deleted"})
        }
        res.status(204).json(deletedBusiness)
    } catch (error) {
        console.error("Error deleting business", error)
        res.status(500).json({message: "Error deleting business"})
    }
};

export const deleteManyBusinesses = async (req: Request, res: Response) => {
    try {
        const deletedBusinesses = await deleteManyBusinessService(req.body)

        if (!deletedBusinesses) {
            res.status(404).json({message: "Businesses not deleted"})
        }
        res.status(204).json(deletedBusinesses)
    } catch (error) {
        console.error("Error deleting businesses", error)
        res.status(500).json({message: "Error deleting businesses"})
    }
};

export const getBusinessPhotos = async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    
    const photos = await prisma.photo.findMany({
      where: { businessId },
      select: {
        id: true,
        s3Key: true,
        s3KeyThumbnail: true,
        s3KeySmall: true,
        s3KeyMedium: true,
        s3KeyLarge: true,
        mainPhoto: true
      }
    });

    // Get signed URLs for each photo variant
    const photosWithUrls = await Promise.all(photos.map(async (photo) => {
      const urls = {
        original: photo.s3Key ? await getImageUrl(photo.s3Key) : null,
        thumbnail: photo.s3KeyThumbnail ? await getImageUrl(photo.s3KeyThumbnail) : null,
        small: photo.s3KeySmall ? await getImageUrl(photo.s3KeySmall) : null,
        medium: photo.s3KeyMedium ? await getImageUrl(photo.s3KeyMedium) : null,
        large: photo.s3KeyLarge ? await getImageUrl(photo.s3KeyLarge) : null
      };

      return {
        ...photo,
        urls
      };
    }));

    res.json(photosWithUrls);
  } catch (error) {
    console.error('Error fetching business photos:', error);
    res.status(500).json({ message: 'Error fetching business photos' });
  }
};