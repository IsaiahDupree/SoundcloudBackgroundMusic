import { Router, Request, Response } from 'express';
import { runPipeline } from '../../pipeline/orchestrator';
import { getStats } from '../../db/trackRepository';
import { logger } from '../../utils/logger';

export const pipelineRoutes = Router();

let pipelineRunning = false;

pipelineRoutes.post('/pipeline/run', async (req: Request, res: Response) => {
  if (pipelineRunning) {
    return res.status(409).json({ error: 'Pipeline already running' });
  }

  const { stage } = req.body;
  pipelineRunning = true;

  // Run async, respond immediately
  res.json({ status: 'started', stage: stage || 'all' });

  try {
    await runPipeline(stage);
  } catch (err: any) {
    logger.error(`Pipeline error: ${err.message}`);
  } finally {
    pipelineRunning = false;
  }
});

pipelineRoutes.get('/pipeline/status', async (_req: Request, res: Response) => {
  try {
    const stats = await getStats();
    res.json({
      running: pipelineRunning,
      ...stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
