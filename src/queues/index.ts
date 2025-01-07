import Bull from 'bull';
import { logger } from '../lib/logger';

// Queue configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100, // Keep only last 100 completed jobs
  removeOnFail: 200,    // Keep more failed jobs for debugging
};

// Create queues for different services
export const queues = {
  googlePlaces: new Bull('google-places-updates', {
    redis: REDIS_CONFIG,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }),
  
  yelp: new Bull('yelp-updates', {
    redis: REDIS_CONFIG,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }),
};

// Common error handler for all queues
const handleJobError = (queueName: string) => (job: Bull.Job, error: Error) => {
  logger.error(`${queueName} job ${job.id} failed:`, error);
  // Add notification logic here (email, Slack, etc.)
};

// Set up error handlers for each queue
Object.entries(queues).forEach(([name, queue]) => {
  queue.on('failed', handleJobError(name));
  queue.on('error', (error) => {
    logger.error(`Queue ${name} error:`, error);
  });
});

// Export all queues
export type QueueKeys = keyof typeof queues;
export const getQueue = (name: QueueKeys) => queues[name];