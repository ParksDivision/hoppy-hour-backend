import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { logger } from '../utils/logger';

const redisConnection = createRedisConnection();

// Create a simple queue
export const emailQueue = new Queue('email', {
  connection: redisConnection,
});

// Create a simple worker
export const emailWorker = new Worker(
  'email',
  async (job) => {
    logger.info(`Processing job ${job.id} with data:`, job.data);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info(`Job ${job.id} completed`);
    return { success: true };
  },
  {
    connection: redisConnection,
  }
);

// Event listeners
emailWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} has been completed`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} has failed with error: ${err.message}`);
});

export const shutdown = async () => {
  logger.info('Shutting down queues and workers...');
  await emailWorker.close();
  await emailQueue.close();
  redisConnection.disconnect();
};
