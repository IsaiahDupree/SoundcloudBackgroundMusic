import express from 'express';
import { env } from '../config/env';
import { queryRoutes } from './routes/query';
import { trackRoutes } from './routes/tracks';
import { pipelineRoutes } from './routes/pipeline';
import { healthRoutes } from './routes/health';
import { logger } from '../utils/logger';

export function createServer(): express.Application {
  const app = express();

  app.use(express.json());
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.use('/api', queryRoutes);
  app.use('/api', trackRoutes);
  app.use('/api', pipelineRoutes);
  app.use('/', healthRoutes);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(`API error: ${err.message}`);
    res.status(500).json({ error: err.message });
  });

  return app;
}

export function startServer(): void {
  const app = createServer();
  app.listen(env.PORT, () => {
    logger.info(`SoundCloud Music API running on http://localhost:${env.PORT}`);
    logger.info(`  POST /api/query — search music by prompt`);
    logger.info(`  GET  /api/tracks — list all tracks`);
    logger.info(`  GET  /health — health check`);
  });
}
