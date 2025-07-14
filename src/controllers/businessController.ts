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
import { Prisma } from '@prisma/client';
import { cloudflareS3Service } from '../utils/cloudflareS3Service';
import { logger } from '../utils/logger/logger';

// Helper function to generate CDN URLs
const generateCDNUrl = (s3Key: string | null | undefined): string | null => {
    if (!s3Key) return null;
    const cdnBaseUrl = process.env.CLOUDFLARE_CDN_BASE_URL;
    if (!cdnBaseUrl) {
        logger.warn('CLOUDFLARE_CDN_BASE_URL not configured');
        return null;
    }
    const cleanKey = s3Key.replace(/^\/+/, '');
    return `${cdnBaseUrl}/${cleanKey}`;
};

// Helper function to transform deals to match frontend expectation
const transformDealsToFrontendFormat = (deals: any[]): any[] => {
    return deals.map(deal => ({
        id: deal.id,
        businessId: deal.businessId,
        dayOfWeek: deal.dayOfWeek,
        startTime: deal.startTime,
        endTime: deal.endTime,
        deals: [deal.title, deal.description].filter(Boolean) // Combine title and description
    }));
};

// Helper function to transform business data for frontend
const transformBusinessForFrontend = (business: any): any => {
    // Transform photos with CDN URLs
    const photosWithCDN = business.photos.map((photo: any) => ({
        id: photo.id,
        businessId: photo.businessId,
        sourceId: photo.sourceId,
        source: photo.source,
        width: photo.width,
        height: photo.height,
        url: photo.url, // Original external URL as fallback
        mainPhoto: photo.mainPhoto,
        s3Key: photo.s3Key,
        s3KeyThumbnail: photo.s3KeyThumbnail,
        s3KeySmall: photo.s3KeySmall,
        s3KeyMedium: photo.s3KeyMedium,
        s3KeyLarge: photo.s3KeyLarge,
        cdnUrls: {
            original: generateCDNUrl(photo.s3Key),
            thumbnail: generateCDNUrl(photo.s3KeyThumbnail),
            small: generateCDNUrl(photo.s3KeySmall),
            medium: generateCDNUrl(photo.s3KeyMedium),
            large: generateCDNUrl(photo.s3KeyLarge),
        },
        fallbackUrl: photo.url
    }));

    // Transform deals for frontend format
    const dealsFormatted = transformDealsToFrontendFormat(business.deals || []);

    return {
        id: business.id,
        name: business.name,
        latitude: business.latitude,
        longitude: business.longitude,
        address: business.address,
        phoneNumber: business.phoneNumber,
        priceLevel: business.priceLevel,
        isBar: business.isBar,
        isRestaurant: business.isRestaurant,
        url: business.url,
        ratingOverall: business.ratingOverall,
        ratingYelp: business.ratingYelp,
        ratingGoogle: business.ratingGoogle,
        operatingHours: business.operatingHours,
        photos: photosWithCDN,
        dealInfo: dealsFormatted
    };
};

// Get one business
export const getOneBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        if (!id) {
            res.status(400).json({ message: "Business ID is required." });
            return;
        }

        const business = await getOneBusinessService({ id });

        if (!business) {
            res.status(404).json({ message: "Business not found." });
            return;
        }

        res.status(200).json(business);
    } catch (error) {
        logger.error({ err: error }, "Error fetching business");
        res.status(500).json({ message: "Error fetching business." });
    }
};

// Get many businesses
export const getManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const businesses = await getManyBusinessService(req.body);

        if (!businesses || businesses.length === 0) {
            res.status(404).json({ message: "Businesses not found." });
            return;
        }

        res.status(200).json(businesses);
    } catch (error) {
        logger.error({ err: error }, "Error fetching businesses");
        res.status(500).json({ message: "Error fetching businesses." });
    }
};

// Get business photos
export const getBusinessPhotos = async (req: Request, res: Response): Promise<void> => {
    try {
        const { businessId } = req.params;
        
        if (!businessId) {
            res.status(400).json({ message: "Business ID is required." });
            return;
        }

        const photos = await prisma.photo.findMany({
            where: { businessId }
        });

        const photosWithCDN = photos.map(photo => ({
            ...photo,
            cdnUrls: {
                original: generateCDNUrl(photo.s3Key),
                thumbnail: generateCDNUrl(photo.s3KeyThumbnail),
                small: generateCDNUrl(photo.s3KeySmall),
                medium: generateCDNUrl(photo.s3KeyMedium),
                large: generateCDNUrl(photo.s3KeyLarge),
            },
            fallbackUrl: photo.url
        }));

        res.status(200).json(photosWithCDN);
    } catch (error) {
        logger.error({ err: error }, "Error fetching business photos");
        res.status(500).json({ message: "Error fetching business photos." });
    }
};

// Search businesses by location
export const searchBusinessesByLocation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { latitude, longitude, radiusKm = 5 } = req.query;
        
        if (!latitude || !longitude) {
            res.status(400).json({ message: "Latitude and longitude are required." });
            return;
        }

        const businesses = await searchBusinesses({
            latitude: parseFloat(latitude as string),
            longitude: parseFloat(longitude as string),
            radiusKm: parseFloat(radiusKm as string)
        });

        const transformedBusinesses = (businesses as any[]).map(transformBusinessForFrontend);
        res.status(200).json(transformedBusinesses);
    } catch (error) {
        logger.error({ err: error }, "Error searching businesses by location");
        res.status(500).json({ message: "Error searching businesses by location." });
    }
};

// Get businesses by category
export const getBusinessesByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category } = req.params;
        
        if (!category) {
            res.status(400).json({ message: "Category is required." });
            return;
        }

        const businesses = await prisma.business.findMany({
            where: {
                categories: {
                    has: category
                }
            },
            include: {
                photos: true,
                deals: true
            }
        });

        const transformedBusinesses = businesses.map(transformBusinessForFrontend);
        res.status(200).json(transformedBusinesses);
    } catch (error) {
        logger.error({ err: error }, "Error fetching businesses by category");
        res.status(500).json({ message: "Error fetching businesses by category." });
    }
};

// Get business statistics
export const getBusinessStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalBusinesses = await prisma.business.count();
        const businessesWithDeals = await prisma.business.count({
            where: { deals: { some: {} } }
        });
        const businessesWithPhotos = await prisma.business.count({
            where: { photos: { some: {} } }
        });
        
        const bars = await prisma.business.count({
            where: { isBar: true }
        });
        
        const restaurants = await prisma.business.count({
            where: { isRestaurant: true }
        });

        const averageRating = await prisma.business.aggregate({
            _avg: { ratingOverall: true }
        });

        const sourceBreakdown = await prisma.business.groupBy({
            by: ["source"],
            _count: { source: true }
        });

        res.status(200).json({
            totalBusinesses,
            breakdown: {
                bars,
                restaurants,
                withDeals: businessesWithDeals,
                withPhotos: businessesWithPhotos
            },
            dealCoverage: totalBusinesses > 0 ? 
                (businessesWithDeals / totalBusinesses * 100).toFixed(1) : 0,
            photoCoverage: totalBusinesses > 0 ? 
                (businessesWithPhotos / totalBusinesses * 100).toFixed(1) : 0,
            averageRating: averageRating._avg.ratingOverall || 0,
            sources: sourceBreakdown.reduce((acc, item) => {
                const sourceValue = item['source'];
                if (typeof sourceValue === 'string') {
                    acc[sourceValue.toLowerCase()] = item._count?.source ?? 0;
                } else if (typeof sourceValue === 'boolean' && sourceValue === true) {
                    acc['unknown'] = item._count?.source ?? 0;
                }
                return acc;
            }, {} as Record<string, number>),
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching business stats');
        res.status(500).json({ message: 'Error fetching business statistics' });
    }
};

// Get businesses with active deals
export const getBusinessesWithActiveDeals = async (req: Request, res: Response): Promise<void> => {
    try {
        const businesses = await prisma.business.findMany({
            where: {
                deals: {
                    some: {}
                }
            },
            include: {
                photos: true,
                deals: true
            }
        });

        const transformedBusinesses = businesses.map(transformBusinessForFrontend);
        res.status(200).json(transformedBusinesses);
    } catch (error) {
        logger.error({ err: error }, "Error fetching businesses with deals");
        res.status(500).json({ message: "Error fetching businesses with deals." });
    }
};

// Get business stats for deals
export const getBusinessStatsForDeals = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalBusinesses = await prisma.business.count();
        const businessesWithDeals = await prisma.business.count({
            where: { deals: { some: {} } }
        });
        const totalActiveDeals = await prisma.deal.count();

        res.status(200).json({
            totalBusinesses,
            businessesWithDeals,
            businessesWithoutDeals: totalBusinesses - businessesWithDeals,
            dealCoverage: totalBusinesses > 0 ? 
                (businessesWithDeals / totalBusinesses * 100).toFixed(1) : 0,
            totalActiveDeals,
            averageDealsPerBusiness: businessesWithDeals > 0 ? 
                (totalActiveDeals / businessesWithDeals).toFixed(1) : 0,
            note: "Deal processing is currently operational"
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching deal stats');
        res.status(500).json({ message: 'Error fetching deal statistics' });
    }
};

// Create one business
export const createBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const business = await createBusinessService(req.body);
        if (!business) {
            res.status(400).json({ message: "Business not created." });
            return;
        }
        res.status(201).json(business);
    } catch (error) {
        logger.error({ err: error }, "Error creating business");
        res.status(500).json({ message: "Error creating business." });
    }
};

// Create many businesses
export const createManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const businesses = await createManyBusinessService(req.body);
        if (!businesses) {
            res.status(400).json({ message: "Businesses not created." });
            return;
        }
        res.status(201).json(businesses);
    } catch (error) {
        logger.error({ err: error }, "Error creating businesses");
        res.status(500).json({ message: "Error creating businesses." });
    }
};

// Update one business
export const updateBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        if (!id) {
            res.status(400).json({ message: "Business ID is required." });
            return;
        }

        const updatedBusiness = await updateOneBusinessService({ id }, req.body);
        if (!updatedBusiness) {
            res.status(404).json({ message: "Business not updated." });
            return;
        }
        res.status(200).json(updatedBusiness);
    } catch (error) {
        logger.error({ err: error }, "Error updating business");
        res.status(500).json({ message: "Error updating business." });
    }
};

// Update many businesses
export const updateManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const { businessIds, updateData } = req.body;
        
        if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
            res.status(400).json({ message: "Business IDs array is required." });
            return;
        }

        const updatedBusinesses = await updateManyBusinessService(businessIds, updateData);
        if (!updatedBusinesses) {
            res.status(404).json({ message: "Businesses not updated." });
            return;
        }
        res.status(200).json(updatedBusinesses);
    } catch (error) {
        logger.error({ err: error }, "Error updating businesses");
        res.status(500).json({ message: "Error updating businesses." });
    }
};

// Delete one business
export const deleteBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        if (!id) {
            res.status(400).json({ message: "Business ID is required." });
            return;
        }

        const deletedBusiness = await deleteOneBusinessService({ id });
        if (!deletedBusiness) {
            res.status(404).json({ message: "Business not deleted." });
            return;
        }
        res.status(204).send();
    } catch (error) {
        logger.error({ err: error }, "Error deleting business");
        res.status(500).json({ message: "Error deleting business." });
    }
};

// Delete many businesses
export const deleteManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const { businessIds } = req.body;
        
        if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
            res.status(400).json({ message: "Business IDs array is required." });
            return;
        }

        const deletedBusinesses = await deleteManyBusinessService({ id: { in: businessIds } });
        if (!deletedBusinesses) {
            res.status(404).json({ message: "Businesses not deleted." });
            return;
        }
        res.status(204).send();
    } catch (error) {
        logger.error({ err: error }, "Error deleting businesses");
        res.status(500).json({ message: "Error deleting businesses." });
    }
};