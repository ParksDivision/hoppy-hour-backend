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
import { 
    findBusinessById,
    searchBusinesses 
} from '../repositories/businessRepository';
import prisma from '../prismaClient';
import { cloudflareS3Service } from '../utils/cloudflareS3Service'; // Updated import
import { logger } from '../utils/logger/logger';

export const getOneBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        // Use functional repository instead of service
        const business = id ? await findBusinessById(id) : await getOneBusinessService(req.body);

        if (!business) {
            res.status(404).json({ message: "Business not found." });
            return;
        }
        
        res.status(200).json(business);
    } catch (error) {
        console.error("Error fetching business:", error);
        res.status(500).json({ message: "Error fetching business." });
    }
};

export const getManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        // Support both query parameters and body for search criteria
        const criteria = {
            name: req.query.name as string,
            latitude: req.query.lat ? parseFloat(req.query.lat as string) : undefined,
            longitude: req.query.lng ? parseFloat(req.query.lng as string) : undefined,
            radiusKm: req.query.radius ? parseFloat(req.query.radius as string) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
            ...req.body
        };

        // Use functional repository for search
        const businesses = Object.keys(criteria).some(key => criteria[key as keyof typeof criteria] !== undefined)
            ? await searchBusinesses(criteria)
            : await getManyBusinessService(req.body);

        if (!businesses || businesses.length === 0) {
            res.status(404).json({ message: "Businesses not found." });
            return;
        }
        
        res.json(businesses);
    } catch (error) {
        console.error("Error fetching businesses:", error);
        res.status(500).json({ message: "Error fetching businesses." });
    }
};

export const createBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const business = await createBusinessService(req.body);

        if (!business) {
            res.status(400).json({ message: "Business not created." });
            return;
        }
        
        res.status(201).json(business);
    } catch (error) {
        console.error("Error creating business:", error);
        res.status(500).json({ message: "Error creating business." });
    }
};

export const createManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const businesses = await createManyBusinessService(req.body);

        if (!businesses) {
            res.status(400).json({ message: "Businesses not created." });
            return;
        }
        
        res.status(201).json(businesses);
    } catch (error) {
        console.error("Error creating businesses:", error);
        res.status(500).json({ message: "Error creating businesses." });
    }
};

export const updateBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedBusiness = await updateOneBusinessService(req.body);

        if (!updatedBusiness) {
            res.status(404).json({ message: "Business not updated." });
            return;
        }
        
        res.status(200).json(updatedBusiness);
    } catch (error) {
        console.error("Error updating business:", error);
        res.status(500).json({ message: "Error updating business." });
    }
};

export const updateManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedBusinesses = await updateManyBusinessService(req.body);

        if (!updatedBusinesses) {
            res.status(404).json({ message: "Businesses not updated." });
            return;
        }
        
        res.status(200).json(updatedBusinesses);
    } catch (error) {
        console.error("Error updating businesses:", error);
        res.status(500).json({ message: "Error updating businesses." });
    }
};

export const deleteBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedBusiness = await deleteOneBusinessService(req.body);

        if (!deletedBusiness) {
            res.status(404).json({ message: "Business not deleted." });
            return;
        }
        
        res.status(204).json(deletedBusiness);
    } catch (error) {
        console.error("Error deleting business:", error);
        res.status(500).json({ message: "Error deleting business." });
    }
};

export const deleteManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedBusinesses = await deleteManyBusinessService(req.body);

        if (!deletedBusinesses) {
            res.status(404).json({ message: "Businesses not deleted." });
            return;
        }
        
        res.status(204).json(deletedBusinesses);
    } catch (error) {
        console.error("Error deleting businesses:", error);
        res.status(500).json({ message: "Error deleting businesses." });
    }
};

export const getBusinessPhotos = async (req: Request, res: Response): Promise<void> => {
    try {
        const { businessId } = req.params;
        const { useCDN = 'true' } = req.query;
        
        const photos = await prisma.photo.findMany({
            where: { businessId },
            select: {
                id: true,
                sourceId: true,
                source: true,
                width: true,
                height: true,
                url: true,
                mainPhoto: true,
                s3Key: true,
                s3KeyThumbnail: true,
                s3KeySmall: true,
                s3KeyMedium: true,
                s3KeyLarge: true
            }
        });

        // If Cloudflare CDN is enabled and requested, generate CDN URLs
        if (useCDN === 'true' && process.env.CLOUDFLARE_CDN_ENABLED === 'true') {
            const photosWithCDNUrls = photos.map(photo => {
                const cdnBaseUrl = process.env.CLOUDFLARE_CDN_BASE_URL;
                
                const generateCDNUrl = (s3Key: string | null) => 
                    s3Key && cdnBaseUrl ? `${cdnBaseUrl}/${s3Key.replace(/^\/+/, '')}` : null;

                return {
                    ...photo,
                    cdnUrls: {
                        original: generateCDNUrl(photo.s3Key),
                        thumbnail: generateCDNUrl(photo.s3KeyThumbnail),
                        small: generateCDNUrl(photo.s3KeySmall),
                        medium: generateCDNUrl(photo.s3KeyMedium),
                        large: generateCDNUrl(photo.s3KeyLarge)
                    }
                };
            });

            res.json(photosWithCDNUrls);
            return;
        }

        // Fallback: Get signed URLs from S3 (with cost control)
        const photosWithUrls = await Promise.all(photos.map(async (photo) => {
            try {
                const urls = {
                    original: photo.s3Key ? await cloudflareS3Service.getImageUrl(photo.s3Key, false) : null,
                    thumbnail: photo.s3KeyThumbnail ? await cloudflareS3Service.getImageUrl(photo.s3KeyThumbnail, false) : null,
                    small: photo.s3KeySmall ? await cloudflareS3Service.getImageUrl(photo.s3KeySmall, false) : null,
                    medium: photo.s3KeyMedium ? await cloudflareS3Service.getImageUrl(photo.s3KeyMedium, false) : null,
                    large: photo.s3KeyLarge ? await cloudflareS3Service.getImageUrl(photo.s3KeyLarge, false) : null
                };

                return {
                    ...photo,
                    urls
                };
            } catch (error) {
                logger.error(`Failed to generate URLs for photo ${photo.id}`, { error });
                return {
                    ...photo,
                    urls: {
                        original: null,
                        thumbnail: null,
                        small: null,
                        medium: null,
                        large: null
                    }
                };
            }
        }));

        res.json(photosWithUrls);
    } catch (error) {
        console.error('Error fetching business photos:', error);
        res.status(500).json({ message: 'Error fetching business photos' });
    }
};

// New functional endpoints leveraging the repository layer
export const searchBusinessesByLocation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { lat, lng, radius = 1 } = req.query;
        
        if (!lat || !lng) {
            res.status(400).json({ 
                message: "Latitude and longitude are required" 
            });
            return;
        }

        const businesses = await searchBusinesses({
            latitude: parseFloat(lat as string),
            longitude: parseFloat(lng as string),
            radiusKm: parseFloat(radius as string),
            limit: req.query.limit ? parseInt(req.query.limit as string) : 50
        });

        res.json({
            results: businesses,
            count: businesses.length,
            searchCriteria: {
                latitude: parseFloat(lat as string),
                longitude: parseFloat(lng as string),
                radiusKm: parseFloat(radius as string)
            }
        });
    } catch (error) {
        console.error('Error searching businesses by location:', error);
        res.status(500).json({ message: 'Error searching businesses by location' });
    }
};

export const getBusinessesByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category } = req.params;
        const { isBar, isRestaurant } = req.query;
        
        // This would need to be implemented in the repository
        // For now, using the existing service
        const businesses = await getManyBusinessService({});
        
        // Filter by category and type
        const filtered = businesses.filter((business: any) => {
            const categoryMatch = business.categories?.some((cat: string) => 
                cat.toLowerCase().includes(category.toLowerCase())
            );
            
            const typeMatch = 
                (isBar === 'true' && business.isBar) ||
                (isRestaurant === 'true' && business.isRestaurant) ||
                (!isBar && !isRestaurant);
            
            return categoryMatch && typeMatch;
        });

        res.json({
            results: filtered,
            count: filtered.length,
            category,
            filters: { isBar, isRestaurant }
        });
    } catch (error) {
        console.error('Error fetching businesses by category:', error);
        res.status(500).json({ message: 'Error fetching businesses by category' });
    }
};

export const getBusinessStats = async (req: Request, res: Response): Promise<void> => {
    try {
        // Get aggregated statistics using functional approach
        const totalBusinesses = await prisma.business.count();
        const totalBars = await prisma.business.count({ where: { isBar: true } });
        const totalRestaurants = await prisma.business.count({ where: { isRestaurant: true } });
        const businessesWithPhotos = await prisma.business.count({
            where: {
                photos: {
                    some: {}
                }
            }
        });

        const averageRating = await prisma.business.aggregate({
            _avg: {
                ratingOverall: true
            }
        });

        const sourceBreakdown = {
            google: await prisma.business.count({ 
                where: { 
                    placeId: { 
                        not: null 
                    } 
                } 
            }),
            yelp: await prisma.business.count({ 
                where: { 
                    yelpId: { 
                        not: null 
                    } 
                } 
            }),
            manual: await prisma.business.count({ 
                where: { 
                    AND: [
                        { placeId: null },
                        { yelpId: null }
                    ]
                }
            })
        };

        // Get cost report from Cloudflare S3 service
        const costReport = await cloudflareS3Service.getCostReport();

        res.json({
            totalBusinesses,
            breakdown: {
                bars: totalBars,
                restaurants: totalRestaurants,
                withPhotos: businessesWithPhotos
            },
            averageRating: averageRating._avg.ratingOverall || 0,
            sources: sourceBreakdown,
            costInfo: {
                currentSpent: costReport.currentMonth.total,
                remainingBudget: costReport.remainingBudget,
                emergencyMode: costReport.emergencyMode,
                projectedMonthly: costReport.projectedMonthly
            },
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching business stats:', error);
        res.status(500).json({ message: 'Error fetching business statistics' });
    }
};