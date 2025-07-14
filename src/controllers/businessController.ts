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
const transformDealsToFrontendFormat = (deals: any[]) => {
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
const transformBusinessForFrontend = (business: any) => {
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
        // CDN URLs for direct use
        cdnUrls: {
            original: generateCDNUrl(photo.s3Key),
            thumbnail: generateCDNUrl(photo.s3KeyThumbnail),
            small: generateCDNUrl(photo.s3KeySmall),
            medium: generateCDNUrl(photo.s3KeyMedium),
            large: generateCDNUrl(photo.s3KeyLarge)
        }
    }));

    // Transform deals to match frontend expectation
    const dealInfo = transformDealsToFrontendFormat(business.deals || []);

    return {
        id: business.id,
        name: business.name,
        latitude: business.latitude,
        longitude: business.longitude,
        address: business.address,
        phoneNumber: business.phone,
        priceLevel: business.priceLevel,
        isBar: business.isBar,
        isRestaurant: business.isRestaurant,
        url: business.website,
        ratingOverall: business.ratingOverall,
        ratingYelp: business.ratingYelp,
        ratingGoogle: business.ratingGoogle,
        operatingHours: business.operatingHours ? business.operatingHours.join(', ') : null,
        categories: business.categories || [], // FIXED: Include categories field
        photos: photosWithCDN,
        dealInfo: dealInfo // Frontend expects 'dealInfo', not 'deals'
    };
};

export const getOneBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        if (!id) {
            res.status(400).json({ message: "Business ID is required." });
            return;
        }

        const business = await prisma.business.findUnique({
            where: { id },
            include: {
                photos: {
                    orderBy: { mainPhoto: 'desc' }
                },
                deals: {
                    where: { isActive: true },
                    orderBy: { startTime: 'asc' }
                }
            }
        });

        if (!business) {
            res.status(404).json({ message: "Business not found." });
            return;
        }
        
        const transformedBusiness = transformBusinessForFrontend(business);
        res.status(200).json(transformedBusiness);
    } catch (error) {
        logger.error({ err: error }, "Error fetching business");
        res.status(500).json({ message: "Error fetching business." });
    }
};

export const getManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            limit = '50', 
            offset = '0', 
            withPhotosOnly = 'false',
            page = '1'
        } = req.query;
        
        const pageSize = parseInt(limit as string);
        const pageNumber = parseInt(page as string);
        const skip = (pageNumber - 1) * pageSize;
        
        let whereClause: any = {};
        
        if (withPhotosOnly === 'true') {
            whereClause = {
                photos: {
                    some: {}
                }
            };
        }

        const [businesses, totalCount] = await Promise.all([
            prisma.business.findMany({
                where: whereClause,
                include: {
                    photos: {
                        orderBy: { mainPhoto: 'desc' },
                        take: 10
                    },
                    deals: {
                        where: { isActive: true },
                        orderBy: { startTime: 'asc' }
                    }
                },
                orderBy: [
                    { ratingOverall: 'desc' },
                    { name: 'asc' }
                ],
                take: pageSize,
                skip: skip
            }),
            prisma.business.count({ where: whereClause })
        ]);

        if (!businesses || businesses.length === 0) {
            res.status(200).json({
                businesses: [],
                count: 0,
                totalCount: 0,
                page: pageNumber,
                totalPages: 0,
                hasMore: false
            });
            return;
        }

        const transformedBusinesses = businesses.map(transformBusinessForFrontend);

        const totalPages = Math.ceil(totalCount / pageSize);
        const hasMore = pageNumber < totalPages;

        res.json({
            businesses: transformedBusinesses,
            count: transformedBusinesses.length,
            totalCount,
            page: pageNumber,
            totalPages,
            hasMore,
            filters: {
                withPhotosOnly: withPhotosOnly === 'true',
                limit: pageSize,
                offset: skip
            }
        });

    } catch (error) {
        logger.error({ err: error }, "Error fetching businesses");
        res.status(500).json({ message: "Error fetching businesses." });
    }
};

export const getBusinessesByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category } = req.params;
        const { isBar, isRestaurant, withDealsOnly = 'false' } = req.query;
        
        const whereClause: any = {};
        
        if (withDealsOnly === 'true') {
            whereClause.deals = {
                some: { isActive: true }
            };
        }

        if (isBar === 'true') whereClause.isBar = true;
        if (isRestaurant === 'true') whereClause.isRestaurant = true;

        // FIXED: Make sure we fetch all necessary fields including categories
        const businesses = await prisma.business.findMany({
            where: whereClause,
            include: {
                photos: {
                    where: { mainPhoto: true },
                    take: 1
                },
                deals: {
                    where: { isActive: true },
                    orderBy: { startTime: 'asc' }
                }
            }
        });

        const transformedBusinesses = businesses.map(transformBusinessForFrontend);

        // FIXED: Now we can safely filter by categories since they're included in the transform
        const filtered = transformedBusinesses.filter(business => {
            // Check if categories exist and filter by category
            if (!business.categories || !Array.isArray(business.categories)) {
                return false;
            }
            
            return business.categories.some((cat: string) => 
                cat.toLowerCase().includes(category.toLowerCase())
            );
        });

        res.json({
            results: filtered,
            count: filtered.length,
            category,
            filters: { 
                isBar, 
                isRestaurant, 
                withDealsOnly: withDealsOnly === 'true'
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching businesses by category');
        res.status(500).json({ message: 'Error fetching businesses by category' });
    }
};

export const getBusinessPhotos = async (req: Request, res: Response): Promise<void> => {
    try {
        const { businessId } = req.params;
        
        const photos = await prisma.photo.findMany({
            where: { businessId },
            orderBy: { mainPhoto: 'desc' }
        });

        const photosWithCDNUrls = photos.map(photo => ({
            id: photo.id,
            businessId: photo.businessId,
            sourceId: photo.sourceId,
            source: photo.source,
            width: photo.width,
            height: photo.height,
            url: photo.url,
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
                large: generateCDNUrl(photo.s3KeyLarge)
            },
            fallbackUrl: photo.url
        }));

        res.json(photosWithCDNUrls);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching business photos');
        res.status(500).json({ message: 'Error fetching business photos' });
    }
};

// Keep all other existing functions...
export const getBusinessesWithActiveDeals = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentDay = new Date().getDay();
        const currentTime = new Date().toTimeString().slice(0, 5);
        const { limit = 50, offset = 0 } = req.query;
        
        const businesses = await prisma.business.findMany({
            where: {
                deals: {
                    some: {
                        isActive: true,
                        OR: [
                            {
                                dayOfWeek: currentDay,
                                startTime: { lte: currentTime },
                                endTime: { gte: currentTime }
                            },
                            {
                                dayOfWeek: currentDay,
                                startTime: null
                            },
                            {
                                dayOfWeek: null
                            }
                        ]
                    }
                }
            },
            include: {
                photos: {
                    orderBy: { mainPhoto: 'desc' },
                    take: 5
                },
                deals: {
                    where: {
                        isActive: true,
                        OR: [
                            { dayOfWeek: currentDay },
                            { dayOfWeek: null }
                        ]
                    },
                    orderBy: { startTime: 'asc' }
                }
            },
            orderBy: [
                { ratingOverall: 'desc' },
                { name: 'asc' }
            ],
            take: parseInt(limit as string),
            skip: parseInt(offset as string)
        });

        const transformedBusinesses = businesses.map(transformBusinessForFrontend);

        res.json({
            businesses: transformedBusinesses,
            count: transformedBusinesses.length,
            currentDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay],
            currentTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error({ err: error }, 'Failed to get businesses with active deals');
        res.status(500).json({ message: "Error fetching businesses with active deals." });
    }
};

// Location-based search
export const searchBusinessesByLocation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { lat, lng, radius = 1, withDealsOnly = 'false' } = req.query;
        
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

        const transformedBusinesses = businesses.map(transformBusinessForFrontend);

        const filteredBusinesses = withDealsOnly === 'true' 
            ? transformedBusinesses.filter(business => 
                business.dealInfo && business.dealInfo.length > 0
              )
            : transformedBusinesses;

        res.json({
            results: filteredBusinesses,
            count: filteredBusinesses.length,
            searchCriteria: {
                latitude: parseFloat(lat as string),
                longitude: parseFloat(lng as string),
                radiusKm: parseFloat(radius as string),
                withDealsOnly: withDealsOnly === 'true'
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error searching businesses by location');
        res.status(500).json({ message: 'Error searching businesses by location' });
    }
};

export const getBusinessStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalBusinesses = await prisma.business.count();
        const totalBars = await prisma.business.count({ where: { isBar: true } });
        const totalRestaurants = await prisma.business.count({ where: { isRestaurant: true } });
        
        const businessesWithDeals = await prisma.business.count({
            where: {
                deals: {
                    some: { isActive: true }
                }
            }
        });

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

        const costReport = await cloudflareS3Service.getCostReport();

        res.json({
            totalBusinesses,
            breakdown: {
                bars: totalBars,
                restaurants: totalRestaurants,
                withDeals: businessesWithDeals,
                withPhotos: businessesWithPhotos
            },
            dealCoverage: totalBusinesses > 0 ? (businessesWithDeals / totalBusinesses * 100).toFixed(1) : 0,
            photoCoverage: totalBusinesses > 0 ? (businessesWithPhotos / totalBusinesses * 100).toFixed(1) : 0,
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
        logger.error({ err: error }, 'Error fetching business stats');
        res.status(500).json({ message: 'Error fetching business statistics' });
    }
};

// Add other CRUD operations here...
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

export const updateBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedBusiness = await updateOneBusinessService(req.body);
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

export const updateManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedBusinesses = await updateManyBusinessService(req.body);
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

export const deleteBusiness = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedBusiness = await deleteOneBusinessService(req.body);
        if (!deletedBusiness) {
            res.status(404).json({ message: "Business not deleted." });
            return;
        }
        res.status(204).json(deletedBusiness);
    } catch (error) {
        logger.error({ err: error }, "Error deleting business");
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
        logger.error({ err: error }, "Error deleting businesses");
        res.status(500).json({ message: "Error deleting businesses." });
    }
};

export const getBusinessStatsForDeals = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalBusinesses = await prisma.business.count();
        
        const businessesWithDeals = await prisma.business.count({
            where: {
                deals: {
                    some: { isActive: true }
                }
            }
        });

        const businessesWithPhotos = await prisma.business.count({
            where: {
                photos: { some: {} }
            }
        });

        const totalActiveDeals = await prisma.deal.count({
            where: { isActive: true }
        });

        const dealsByDay = await prisma.deal.groupBy({
            by: ['dayOfWeek'],
            where: { isActive: true },
            _count: true
        });

        const dealsByDayFormatted = dealsByDay.reduce((acc, item) => {
            if (item.dayOfWeek !== null) {
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][item.dayOfWeek];
                acc[dayName] = item._count;
            } else {
                acc['All Week'] = item._count;
            }
            return acc;
        }, {} as Record<string, number>);

        const averageRating = await prisma.business.aggregate({
            _avg: {
                ratingOverall: true
            }
        });

        res.json({
            totalBusinesses,
            businessesWithDeals,
            businessesWithoutDeals: totalBusinesses - businessesWithDeals,
            businessesWithPhotos,
            photoCoverage: totalBusinesses > 0 ? (businessesWithPhotos / totalBusinesses * 100).toFixed(1) : 0,
            dealCoverage: totalBusinesses > 0 ? (businessesWithDeals / totalBusinesses * 100).toFixed(1) : 0,
            totalActiveDeals,
            averageDealsPerBusiness: businessesWithDeals > 0 ? (totalActiveDeals / businessesWithDeals).toFixed(1) : 0,
            averageRating: averageRating._avg.ratingOverall || 0,
            dealsByDay: dealsByDayFormatted,
            note: "Deal processing is currently paused - deal counts may be outdated"
        });

    } catch (error) {
        logger.error({ err: error }, 'Failed to get business stats');
        res.status(500).json({ message: 'Error fetching business statistics' });
    }
};