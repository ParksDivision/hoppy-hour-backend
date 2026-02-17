/**
 * Google Places Data Collection Controller
 *
 * Handles HTTP requests for Google Places API data collection.
 * Dispatches jobs to background queues for async processing.
 */

import { Request, Response } from 'express';
import { addSearchNearbyJob, addBulkSearchJobs, getQueueStats } from '../../queues/jobs/googlePlacesJobs';
import {
  getAllGoogleRawBusinesses,
  findGoogleRawBusinessById,
  findGoogleRawBusinessesByName,
  countGoogleRawBusinesses,
} from '../../repositories/googleRawBusinessRepository';
import { logger } from '../../utils/logger';
import { getCityCoordinates, getAvailableCities } from '../../config/cityCoordinates';

/**
 * POST /api/data-collection/google/search
 * Trigger a search for nearby businesses using Google Places API
 */
export const searchNearbyPlaces = async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, radius, includedTypes, excludedTypes, maxResultCount } = req.body;

    // Validate required fields
    if (latitude === undefined || latitude === null) {
      res.status(400).json({ error: 'Latitude is required' });
      return;
    }

    if (longitude === undefined || longitude === null) {
      res.status(400).json({ error: 'Longitude is required' });
      return;
    }

    // Validate latitude/longitude ranges
    if (latitude < -90 || latitude > 90) {
      res.status(400).json({ error: 'Latitude must be between -90 and 90' });
      return;
    }

    if (longitude < -180 || longitude > 180) {
      res.status(400).json({ error: 'Longitude must be between -180 and 180' });
      return;
    }

    // Dispatch job to queue
    const job = await addSearchNearbyJob({
      latitude,
      longitude,
      options: {
        radius,
        includedTypes,
        excludedTypes,
        maxResultCount,
      },
      requestedBy: req.ip || 'unknown',
    });

    logger.info(
      {
        jobId: job.id,
        latitude,
        longitude,
        ip: req.ip,
      },
      'Google Places search job queued'
    );

    // Return 202 Accepted - job is queued
    res.status(202).json({
      message: 'Search job queued successfully',
      jobId: job.id,
      status: 'queued',
      data: {
        latitude,
        longitude,
        radius: radius || 'default',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue Google Places search job');
    res.status(500).json({ error: 'Failed to queue search job' });
  }
};

/**
 * POST /api/data-collection/google/search/bulk
 * Trigger multiple searches for different locations
 */
export const bulkSearchNearbyPlaces = async (req: Request, res: Response): Promise<void> => {
  try {
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      res.status(400).json({ error: 'Locations array is required and must not be empty' });
      return;
    }

    // Validate each location
    for (const location of locations) {
      if (location.latitude === undefined || location.longitude === undefined) {
        res.status(400).json({ error: 'Each location must have latitude and longitude' });
        return;
      }
    }

    // Dispatch bulk jobs
    const jobs = await addBulkSearchJobs(locations);

    logger.info(
      {
        count: jobs.length,
        ip: req.ip,
      },
      'Bulk Google Places search jobs queued'
    );

    res.status(202).json({
      message: `${jobs.length} search jobs queued successfully`,
      jobIds: jobs.map((job) => job.id),
      status: 'queued',
      count: jobs.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue bulk search jobs');
    res.status(500).json({ error: 'Failed to queue bulk search jobs' });
  }
};

/**
 * GET /api/data-collection/google/businesses
 * Get all collected businesses with pagination
 */
export const getCollectedBusinesses = async (req: Request, res: Response): Promise<void> => {
  try {
    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 50;

    const [businesses, total] = await Promise.all([
      getAllGoogleRawBusinesses(skip, take),
      countGoogleRawBusinesses(),
    ]);

    res.json({
      businesses,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch collected businesses');
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
};

/**
 * GET /api/data-collection/google/businesses/:id
 * Get a single collected business by ID
 */
export const getCollectedBusinessById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    const business = await findGoogleRawBusinessById(id);

    if (!business) {
      res.status(404).json({ error: 'Business not found' });
      return;
    }

    res.json(business);
  } catch (error) {
    logger.error({ error, id: req.params.id }, 'Failed to fetch business by ID');
    res.status(500).json({ error: 'Failed to fetch business' });
  }
};

/**
 * GET /api/data-collection/google/businesses/search/name
 * Search collected businesses by name
 */
export const searchCollectedBusinessesByName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Name query parameter is required' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;

    const businesses = await findGoogleRawBusinessesByName(name, limit);

    res.json({
      businesses,
      count: businesses.length,
      searchTerm: name,
    });
  } catch (error) {
    logger.error({ error, name: req.query.name }, 'Failed to search businesses by name');
    res.status(500).json({ error: 'Failed to search businesses' });
  }
};

/**
 * GET /api/data-collection/google/queue/stats
 * Get queue statistics
 */
export const getGoogleQueueStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getQueueStats();

    res.json({
      queue: 'google-places',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch queue stats');
    res.status(500).json({ error: 'Failed to fetch queue statistics' });
  }
};

/**
 * POST /api/data-collection/google/search/city
 * Trigger a comprehensive city-wide search using predefined neighborhood coordinates
 */
export const searchCityBusinesses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { city, includedTypes, excludedTypes } = req.body;

    if (!city || typeof city !== 'string') {
      res.status(400).json({ error: 'City name is required' });
      return;
    }

    // Get coordinates for the city
    const coordinates = getCityCoordinates(city);

    if (!coordinates || coordinates.length === 0) {
      const availableCities = getAvailableCities();
      res.status(404).json({
        error: `City '${city}' not found`,
        availableCities,
        hint: `Available cities: ${availableCities.join(', ')}`,
      });
      return;
    }

    // Transform coordinates into bulk search jobs
    const locations = coordinates.map((coord) => ({
      latitude: coord.latitude,
      longitude: coord.longitude,
      options: {
        radius: coord.radius,
        includedTypes,
        excludedTypes,
      },
    }));

    // Queue all searches
    const jobs = await addBulkSearchJobs(locations);

    logger.info(
      {
        city,
        coordinateCount: coordinates.length,
        jobCount: jobs.length,
        ip: req.ip,
      },
      `Queued city-wide search for ${city}`
    );

    res.status(202).json({
      message: `City-wide search for ${city} queued successfully`,
      city,
      jobIds: jobs.map((job) => job.id),
      status: 'queued',
      searchPoints: coordinates.length,
      expectedJobs: jobs.length,
      note: 'Deduplication will automatically handle overlapping results',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to queue city search');
    res.status(500).json({ error: 'Failed to queue city search' });
  }
};
