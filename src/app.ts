import express from 'express'
import router from './routes';
import { setupBullDashboard } from './utils/api/dashboard';
import { initializeScheduler } from './utils/api/scheduler';

const app = express()

app.use(express.json())

// Mount the routes
app.use('/', router);

// Setup Bull dashboard
setupBullDashboard(app);

// // Initialize both Google and Yelp schedulers
// initializeScheduler().catch(error => {
//   console.error('Failed to initialize data retrieval schedulers:', error);
//   process.exit(1);
// });

export default app