import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as inventoryService from '../services/inventory.service';

export const createInventory = asyncHandler(async (req: Request, res: Response) => {
  const inventoryItem = await inventoryService.createInventory(req.body);
  res.status(201).json({ status: 'ok', data: inventoryItem });
});

export const getAllInventory = asyncHandler(async (_req: Request, res: Response) => {
  const inventory = await inventoryService.getAllInventory();
  res.status(200).json({ status: 'ok', data: inventory });
});

export const getInventoryByProductId = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const warehouseId = typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined;

  const inventory = await inventoryService.getInventoryByProductId(productId, warehouseId);
  res.status(200).json({ status: 'ok', data: inventory });
});

export const getInventoryByWarehouseId = asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const inventory = await inventoryService.getInventoryByWarehouseId(warehouseId);
  res.status(200).json({ status: 'ok', data: inventory });
});

export const updateInventory = asyncHandler(async (req: Request, res: Response) => {
  const { inventoryId } = req.params;
  const inventory = await inventoryService.updateInventory(inventoryId, req.body);
  res.status(200).json({ status: 'ok', data: inventory });
});
