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
