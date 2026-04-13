import { Router, Request, Response } from 'express';
import { getStats } from '../../db/trackRepository';

export const healthRoutes = Router();

healthRoutes.get('/health', async (_req: Request, res: Response) => {
  try {
    const stats = await getStats();
    res.json({
      status: 'ok',
      ...stats,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});
