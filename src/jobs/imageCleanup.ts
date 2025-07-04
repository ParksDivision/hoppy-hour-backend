import { cleanupUnusedImages, getMetrics } from '../utils/enhancedS3Service';
import { logger } from '../utils/logger/logger';
import { CronJob } from 'cron';
import prisma from '../prismaClient';

async function cleanupImages() {
  try {
    logger.info('Starting image cleanup job');

    // Get all active S3 keys from the database
    const activePhotos = await prisma.photo.findMany({
      select: {
        s3Key: true,
        s3KeyThumbnail: true,
        s3KeySmall: true,
        s3KeyMedium: true,
        s3KeyLarge: true
      }
    });

    // Create a set of active keys
    const activeKeys = new Set<string>();
    activePhotos.forEach(photo => {
      [
        photo.s3Key,
        photo.s3KeyThumbnail,
        photo.s3KeySmall,
        photo.s3KeyMedium,
        photo.s3KeyLarge
      ].forEach(key => {
        if (key) activeKeys.add(key);
      });
    });

    // Run the cleanup
    await cleanupUnusedImages(30); // Clean images older than 30 days

    // Log metrics
    const metrics = getMetrics();
    logger.info({ metrics }, 'Image processing metrics');

  } catch (error) {
    logger.error({ err: error }, 'Failed to run cleanup job');
  }
}

// Run cleanup job every day at 2 AM
export const cleanupJob = new CronJob(
  '0 2 * * *',
  cleanupUnusedImages,
  null,
  false,
  'UTC'
);