import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as inventoryAvailabilityService from '../services/inventoryAvailability.service';

export const recordInventoryAvailability = asyncHandler(async (req: Request, res: Response) => {
  const result = await inventoryAvailabilityService.recordInventoryAvailability(req.body);
  res.status(200).json({ status: 'ok', data: result });
});
