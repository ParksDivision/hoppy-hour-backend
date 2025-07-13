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

// UPDATED: Now shows all businesses by default (after deduplication and photo processing)
export const getManyBusinesses = async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit, offset, withPhotosOnly = 'false' } = req.query;
        
        // Base query - all businesses
        let whereClause: any = {};
        
        // Optional filter for businesses with photos only
        if (withPhotosOnly === 'true') {
            whereClause = {
                photos: {
                    some: {}
                }
            };
        }

        const businesses = await prisma.business.findMany({
            where: whereClause,
            include: {
                photos: {
                    orderBy: { mainPhoto: 'desc' }, // Main photos first
                    take: 5 // Limit photos per business for performance
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
            take: limit ? parseInt(limit as string) : 50, // Default limit
            skip: offset ? parseInt(offset as string) : undefined
        });

        if (!businesses || businesses.length === 0) {
            res.status(404).json({ 
                message: withPhotosOnly === 'true' 
                    ? "No businesses with photos found." 
                    : "No businesses found." 
            });
            return;
        }

        // Add computed fields for convenience
        const enrichedBusinesses = businesses.map(business => ({
            ...business,
            hasPhotos: business.photos.length > 0,
            hasDeals: business.deals.length > 0,
            photoCount: business.photos.length,
            activeDealsCount: business.deals.length
        }));

        res.json({
            businesses: enrichedBusinesses,
            count: enrichedBusinesses.length,
            filters: {
                withPhotosOnly: withPhotosOnly === 'true',
                limit: limit ? parseInt(limit as string) : 50,
                offset: offset ? parseInt(offset as string) : 0
            },
            note: "Showing all processed businesses (deals processing is currently paused)"
        });

    } catch (error) {
        console.error("Error fetching businesses:", error);
        res.status(500).json({ message: "Error fetching businesses." });
    }
};

// UPDATED: Simplified to show all businesses with optional deal filtering
export const getBusinessesWithActiveDeals = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
        const currentTime = new Date().toTimeString().slice(0, 5); // "HH:MM" format
        const { limit = 50, offset = 0 } = req.query;
        
        const businesses = await prisma.business.findMany({
            where: {
                deals: {
                    some: {
                        isActive: true,
                        OR: [
                            // Deals for current day with time ranges
                            {
                                dayOfWeek: currentDay,
                                startTime: { lte: currentTime },
                                endTime: { gte: currentTime }
                            },
                            // All-day deals for current day
                            {
                                dayOfWeek: currentDay,
                                startTime: null
                            },
                            // Deals without specific day (all-week deals)
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

        // Add computed fields for frontend
        const enrichedBusinesses = businesses.map(business => {
            const currentDeals = business.deals.filter(deal => {
                if (!deal.startTime || !deal.endTime) return true; // All-day deals
                return deal.startTime <= currentTime && deal.endTime >= currentTime;
            });

            const nextDealTime = getNextDealTime(business.deals, currentDay, currentTime);

            return {
                ...business,
                currentDeals,
                hasCurrentDeals: currentDeals.length > 0,
                nextDealTime,
                totalDeals: business.deals.length
            };
        });

        res.json({
            businesses: enrichedBusinesses,
            count: enrichedBusinesses.length,
            currentDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay],
            currentTime,
            timestamp: new Date().toISOString(),
            note: "Active deals endpoint - may return empty while deal processing is paused"
        });

    } catch (error) {
        logger.error({ err: error }, 'Failed to get businesses with active deals');
        res.status(500).json({ message: "Error fetching businesses with active deals." });
    }
};

// Helper function to find next deal time
const getNextDealTime = (deals: any[], currentDay: number, currentTime: string): string | null => {
    const allDeals = deals.filter(deal => deal.startTime);
    
    // Today's future deals
    const todayDeals = allDeals
        .filter(deal => deal.dayOfWeek === currentDay && deal.startTime > currentTime)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    if (todayDeals.length > 0) {
        return `Today at ${formatTime(todayDeals[0].startTime)}`;
    }

    // Tomorrow's deals
    const tomorrowDay = (currentDay + 1) % 7;
    const tomorrowDeals = allDeals
        .filter(deal => deal.dayOfWeek === tomorrowDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    if (tomorrowDeals.length > 0) {
        return `Tomorrow at ${formatTime(tomorrowDeals[0].startTime)}`;
    }

    return null;
};

const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

// UPDATED: General business statistics (not deal-focused)
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

        // Deals by day of week (if any exist)
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

// Existing endpoints remain the same...
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

// Location-based search - updated to include all businesses
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

        // Optional filter by deals
        const filteredBusinesses = withDealsOnly === 'true' 
            ? businesses.filter((business: any) => 
                business.deals && business.deals.some((deal: any) => deal.isActive)
              )
            : businesses;

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
        console.error('Error searching businesses by location:', error);
        res.status(500).json({ message: 'Error searching businesses by location' });
    }
};

export const getBusinessesByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category } = req.params;
        const { isBar, isRestaurant, withDealsOnly = 'false' } = req.query;
        
        const whereClause: any = {};
        
        // Optional deals filter 
        if (withDealsOnly === 'true') {
            whereClause.deals = {
                some: { isActive: true }
            };
        }

        // Add type filters
        if (isBar === 'true') whereClause.isBar = true;
        if (isRestaurant === 'true') whereClause.isRestaurant = true;

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

        // Filter by category in business categories
        const filtered = businesses.filter((business: any) => {
            return business.categories?.some((cat: string) => 
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

        // Get cost report from Cloudflare S3 service
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
            note: "Deal processing is currently paused - showing all processed businesses",
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching business stats:', error);
        res.status(500).json({ message: 'Error fetching business statistics' });
    }
};