import cors from 'cors';
import express, { Application } from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import apiRoutes from './routes';

export const createApp = (): Application => {
  const app: Application = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const app = createApp();

export default app;
