import express from 'express'
import router from './routes';
import cors from 'cors';
import { setupBullDashboard } from './utils/api/dashboard';
import { initializeScheduler } from './utils/api/scheduler';
import { oneTimeGoogleDataUpdate } from './utils/api/scheduler';

const app = express()

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? 'your-production-domain.com' 
      : 'http://localhost:3000'
  }));

app.use(express.json())

// Mount the routes
app.use('/', router);

// Setup Bull dashboard
setupBullDashboard(app);

export default app