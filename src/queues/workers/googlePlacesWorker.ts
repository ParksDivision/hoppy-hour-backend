/**
 * Google Places Background Worker
 *
 * This worker processes jobs from the google-places queue.
 * It handles async operations like searching nearby places and fetching place details,
 * then transforms and saves the data to the database.
 */

import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../../config/redis';
import { logger } from '../../utils/logger';
import {
  searchNearbyPlaces,
  getPlaceDetails,
  transformPlaceToBusinessData,
} from '../../services/googlePlaces/service';
import {
  bulkCreateGoogleRawBusinesses,
  createGoogleRawBusiness,
} from '../../repositories/googleRawBusinessRepository';
import type { SearchNearbyJobData, PlaceDetailsJobData } from '../jobs/googlePlacesJobs';

/**
 * Process searchNearby jobs
 * Fetches nearby places from Google Places API and saves to database
 */
const handleSearchNearby = async (job: Job<SearchNearbyJobData>) => {
  const { latitude, longitude, options, requestedBy = 'system' } = job.data;

  logger.info(
    {
      jobId: job.id,
      latitude,
      longitude,
    },
    'Processing searchNearby job'
  );

  // Update job progress
  await job.updateProgress(10);

  // Call Google Places API
  const response = await searchNearbyPlaces(latitude, longitude, options);

  await job.updateProgress(50);

  if (!response.places || response.places.length === 0) {
    logger.warn({ jobId: job.id, latitude, longitude }, 'No places found in search');
    return { success: true, count: 0, message: 'No places found' };
  }

  // Transform all places to database format
  const businesses = response.places.map((place) => transformPlaceToBusinessData(place));

  await job.updateProgress(75);

  // Bulk insert into database
  const result = await bulkCreateGoogleRawBusinesses(businesses, requestedBy);

  await job.updateProgress(100);

  logger.info(
    {
      jobId: job.id,
      latitude,
      longitude,
      placesFound: response.places.length,
      savedCount: result.count,
    },
    'Completed searchNearby job'
  );

  return {
    success: true,
    count: result.count,
    totalPlaces: response.places.length,
    latitude,
    longitude,
  };
};

/**
 * Process placeDetails jobs
 * Fetches detailed place information and saves to database
 */
const handlePlaceDetails = async (job: Job<PlaceDetailsJobData>) => {
  const { placeId, detailLevel = 'standard', requestedBy = 'system' } = job.data;

  logger.info(
    {
      jobId: job.id,
      placeId,
      detailLevel,
    },
    'Processing placeDetails job'
  );

  await job.updateProgress(25);

  // Fetch place details from Google Places API
  const place = await getPlaceDetails(placeId, detailLevel);

  await job.updateProgress(60);

  // Transform to database format
  const businessData = transformPlaceToBusinessData(place);

  await job.updateProgress(80);

  // Save to database
  const business = await createGoogleRawBusiness(businessData, requestedBy);

  await job.updateProgress(100);

  logger.info(
    {
      jobId: job.id,
      placeId,
      businessId: business.id,
      businessName: business.name,
    },
    'Completed placeDetails job'
  );

  return {
    success: true,
    businessId: business.id,
    placeId,
    name: business.name,
  };
};

/**
 * Main worker processor
 * Routes jobs to appropriate handlers based on job name
 */
export const googlePlacesWorker = new Worker(
  'google-places',
  async (job: Job) => {
    try {
      switch (job.name) {
        case 'searchNearby':
          return await handleSearchNearby(job as Job<SearchNearbyJobData>);

        case 'placeDetails':
          return await handlePlaceDetails(job as Job<PlaceDetailsJobData>);

        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      logger.error(
        {
          jobId: job.id,
          jobName: job.name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Job processing failed'
      );
      throw error; // Re-throw to trigger BullMQ retry logic
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 5, // Process up to 5 jobs simultaneously
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second (rate limiting)
    },
  }
);

// Event listeners for monitoring
googlePlacesWorker.on('completed', (job) => {
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      duration: job.finishedOn ? job.finishedOn - (job.processedOn || job.timestamp) : 0,
    },
    'Job completed successfully'
  );
});

googlePlacesWorker.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    },
    'Job failed'
  );
});

googlePlacesWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Worker error');
});

googlePlacesWorker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Job stalled');
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing Google Places worker gracefully');
  await googlePlacesWorker.close();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing Google Places worker gracefully');
  await googlePlacesWorker.close();
});
