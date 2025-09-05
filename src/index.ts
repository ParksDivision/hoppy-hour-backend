import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { userRoutes } from './routes/userRoutes';
import { queueRoutes } from './routes/queueRoutes';
import { logger } from './utils/logger';
import pinoHttp from 'pino-http';
import { shutdown } from './queues';

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3001;

const corsOptions = {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP',
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/users', userRoutes);
app.use('/api/queues', queueRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error: Error, req: express.Request, res: express.Response) => {
  logger.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const initializeServer = async () => {
  logger.info('BullMQ queue system ready');
};

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await shutdown();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

void initializeServer().then(() => {
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    logger.info('BullMQ email queue ready');
  });
});

export default app;
