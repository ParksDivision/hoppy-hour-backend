import { queues } from '../../queues';
import { logger } from '../../lib/logger';
import { updateGooglePlacesData } from './google';
import { updateYelpData } from './yelp';

// Schedule configurations
const SCHEDULES = {
  MIDNIGHT: '0 0 * * *',
  NOON: '0 12 * * *',
} as const;

// Process Google Places jobs
queues.googlePlaces.process(async (job) => {
  logger.info(`Starting Google Places update: ${job.id}`);
  await updateGooglePlacesData();
  logger.info(`Completed Google Places update: ${job.id}`);
});

// Process Yelp jobs
queues.yelp.process(async (job) => {
  logger.info(`Starting Yelp update: ${job.id}`);
  await updateYelpData();
  logger.info(`Completed Yelp update: ${job.id}`);
});

export const initializeScheduler = async () => {
  // Clean existing jobs
  await Promise.all(
    Object.values(queues).map(queue => 
      Promise.all([
        queue.clean(0, 'delayed'),
        queue.clean(0, 'wait')
      ])
    )
  );

  // Schedule recurring jobs for both services
  for (const schedule of Object.values(SCHEDULES)) {
    // Schedule Google Places updates
    queues.googlePlaces.add(
      {},
      { 
        repeat: { 
          cron: schedule,
          tz: 'America/Chicago'
        }
      }
    );

    // Schedule Yelp updates
    // Add slight delay to avoid hitting APIs simultaneously
    queues.yelp.add(
      {},
      { 
        repeat: { 
          cron: schedule,
          tz: 'America/Chicago'
        },
        delay: 5 * 60 * 1000 // 5 minute delay after Google Places
      }
    );
  }

  logger.info('Business data retrieval schedule initialized');

  // Return cleanup function
  return async () => {
    await Promise.all(
      Object.values(queues).map(queue => queue.close())
    );
    logger.info('Business data retrieval schedulers stopped');
  };
};