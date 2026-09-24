import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { WAREHOUSE_IDS, WarehouseId } from '../utils/inventory.types';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isWarehouseId = (value: unknown): value is WarehouseId =>
  typeof value === 'string' && WAREHOUSE_IDS.includes(value as WarehouseId);

export const validateRecordInventoryAvailability = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { productId, warehouseId, availableQuantity } = req.body ?? {};

  if (!isNonEmptyString(productId)) {
    next(new AppError('productId is required and must be a non-empty string', 400));
    return;
  }

  if (!isWarehouseId(warehouseId)) {
    next(new AppError(`warehouseId must be one of: ${WAREHOUSE_IDS.join(', ')}`, 400));
    return;
  }

  if (
    typeof availableQuantity !== 'number' ||
    !Number.isInteger(availableQuantity) ||
    availableQuantity <= 0
  ) {
    next(new AppError('availableQuantity must be an integer greater than 0', 400));
    return;
  }

  next();
};
