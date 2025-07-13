// server.js
import dotenv from 'dotenv';
dotenv.config();
import { Server } from 'http';
import app from '../src/app';
import { initializeScheduler, oneTimeGoogleDataUpdate } from './utils/api/scheduler';
import { AUSTIN_LOCATIONS } from './utils/api/google/enums';
import { cleanupJob } from './jobs/imageCleanup';

const PORT = process.env.PORT || 3001;

let server: Server;

const startServer = async () => {
  server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

const cleanup = async () => {
    server.close(() => {
      console.log('Server shutdown complete');
      process.exit(0);
    });
};

process.on('SIGTERM', async () => {await cleanup()});
process.on('SIGINT', async () => {await cleanup()});

// Start the cleanup job
cleanupJob.start();

// start server
startServer();

oneTimeGoogleDataUpdate(AUSTIN_LOCATIONS)

// initializeScheduler().catch(error => {
//     console.error('Failed to initialize schedulers:', error);
//     process.exit(1);
// });