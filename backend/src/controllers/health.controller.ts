import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { checkDatabaseConnection } from '../services/health.service';

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const isDatabaseConnected = await checkDatabaseConnection().catch(() => false);

  res.status(200).json({
    status: 'ok',
    database: isDatabaseConnected ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});
