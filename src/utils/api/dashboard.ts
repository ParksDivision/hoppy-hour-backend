// src/services/dashboard.ts
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queues } from '../../queues';

export const setupBullDashboard = (app: any) => {
  const serverAdapter = new ExpressAdapter();

  createBullBoard({
    queues: Object.values(queues).map(queue => new BullAdapter(queue)),
    serverAdapter,
  });

  // Basic auth middleware
  const basicAuth = (req: any, res: any, next: any) => {
    // Only enable auth in production
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    const auth = req.headers.authorization;
    const expectedAuth = 'Basic ' + Buffer.from(
      `${process.env.BULL_ADMIN_USER}:${process.env.BULL_ADMIN_PASS}`
    ).toString('base64');

    if (auth === expectedAuth) {
      next();
    } else {
      res.set('WWW-Authenticate', 'Basic realm="Bull Dashboard"');
      res.status(401).send('Authentication required');
    }
  };

  // Mount the dashboard
  app.use('/admin/queues', basicAuth, serverAdapter.getRouter());
};