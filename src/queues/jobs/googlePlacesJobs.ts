/**
 * Google Places Queue Jobs
 *
 * This file defines the BullMQ queue for Google Places API operations.
 * It provides job types and functions to dispatch async tasks to background workers.
 */

import { Queue } from 'bullmq';
import { createRedisConnection } from '../../config/redis';
import { logger } from '../../utils/logger';
import type { GooglePlacesSearchOptions } from '../../services/googlePlaces/types';

export interface SearchNearbyJobData {
  latitude: number;
  longitude: number;
  options?: GooglePlacesSearchOptions;
  requestedBy?: string;
}

export interface PlaceDetailsJobData {
  placeId: string;
  detailLevel?: 'basic' | 'standard' | 'detailed';
  requestedBy?: string;
}

// Create Google Places queue
export const googlePlacesQueue = new Queue('google-places', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay, doubles each retry
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
      count: 500, // Keep last 500 failed jobs
    },
  },
});

/**
 * Add a job to search nearby places via Google Places API
 *
 * @param data - Search parameters (latitude, longitude, options)
 * @returns Job reference with ID
 */
export const addSearchNearbyJob = async (data: SearchNearbyJobData) => {
  try {
    const job = await googlePlacesQueue.add('searchNearby', data, {
      priority: 1, // Normal priority
    });

    logger.info(
      {
        jobId: job.id,
        latitude: data.latitude,
        longitude: data.longitude,
      },
      'Added searchNearby job to queue'
    );

    return job;
  } catch (error) {
    logger.error({ error, data }, 'Failed to add searchNearby job');
    throw error;
  }
};

/**
 * Add a job to fetch detailed place information
 *
 * @param data - Place ID and detail level
 * @returns Job reference with ID
 */
export const addPlaceDetailsJob = async (data: PlaceDetailsJobData) => {
  try {
    const job = await googlePlacesQueue.add('placeDetails', data, {
      priority: 2, // Lower priority than search
    });

    logger.info(
      {
        jobId: job.id,
        placeId: data.placeId,
      },
      'Added placeDetails job to queue'
    );

    return job;
  } catch (error) {
    logger.error({ error, data }, 'Failed to add placeDetails job');
    throw error;
  }
};

/**
 * Add multiple search jobs in bulk
 *
 * @param locations - Array of search locations
 * @returns Array of job references
 */
export const addBulkSearchJobs = async (
  locations: Array<{ latitude: number; longitude: number; options?: GooglePlacesSearchOptions }>
) => {
  try {
    const jobs = await googlePlacesQueue.addBulk(
      locations.map((location, index) => ({
        name: 'searchNearby',
        data: {
          latitude: location.latitude,
          longitude: location.longitude,
          options: location.options,
        },
        opts: {
          priority: 1,
          delay: index * 1000, // Stagger jobs by 1 second to avoid rate limits
        },
      }))
    );

    logger.info({ count: jobs.length }, 'Added bulk searchNearby jobs to queue');

    return jobs;
  } catch (error) {
    logger.error({ error, count: locations.length }, 'Failed to add bulk search jobs');
    throw error;
  }
};

/**
 * Get queue statistics and health
 *
 * @returns Queue metrics (waiting, active, completed, failed counts)
 */
export const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      googlePlacesQueue.getWaitingCount(),
      googlePlacesQueue.getActiveCount(),
      googlePlacesQueue.getCompletedCount(),
      googlePlacesQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  } catch (error) {
    logger.error({ error }, 'Failed to get queue stats');
    throw error;
  }
};

/**
 * Pause the queue (stop processing new jobs)
 */
export const pauseQueue = async () => {
  await googlePlacesQueue.pause();
  logger.info('Google Places queue paused');
};

/**
 * Resume the queue (start processing jobs)
 */
export const resumeQueue = async () => {
  await googlePlacesQueue.resume();
  logger.info('Google Places queue resumed');
};

/**
 * Clean up old jobs from the queue
 */
export const cleanQueue = async () => {
  const cleaned = await googlePlacesQueue.clean(3600000, 100, 'completed'); // Clean completed jobs older than 1 hour
  logger.info({ cleaned }, 'Cleaned old jobs from queue');
  return cleaned;
};
