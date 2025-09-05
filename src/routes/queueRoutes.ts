import { Request, Response, Router } from 'express';
import { emailQueue } from '../queues';
import { logger } from '../utils/logger';

const router = Router();

// Add a job to the queue
router.post('/email', async (req: Request, res: Response) => {
  try {
    const { email, subject, message } = req.body;

    if (!email || !subject || !message) {
      res.status(400).json({ error: 'email, subject, and message are required' });
      return;
    }

    const job = await emailQueue.add('send-email', {
      email,
      subject,
      message,
      timestamp: Date.now(),
    });

    logger.info(`Email job ${job.id} added to queue`);
    res.status(201).json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    logger.error({ error }, 'Failed to add email job');
    res.status(500).json({ error: 'Failed to add email job' });
  }
});

// Get queue stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const waiting = await emailQueue.getWaiting();
    const active = await emailQueue.getActive();
    const completed = await emailQueue.getCompleted();
    const failed = await emailQueue.getFailed();

    res.json({
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get queue stats');
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

export { router as queueRoutes };
