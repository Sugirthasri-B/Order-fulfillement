import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { isValidDateOnlyString } from '../utils/dateOnly';
import { WAREHOUSE_IDS, WarehouseId } from '../utils/inventory.types';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isWarehouseId = (value: unknown): value is WarehouseId =>
  typeof value === 'string' && WAREHOUSE_IDS.includes(value as WarehouseId);

/**
 * Validates the availableQuantity/earliestDispatchDate fields shared by
 * create and update. Returns an error message, or null if valid.
 */
const validateQuantityAndDate = (body: unknown): string | null => {
  const { availableQuantity, earliestDispatchDate } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof availableQuantity !== 'number' ||
    !Number.isInteger(availableQuantity) ||
    availableQuantity <= 0
  ) {
    return 'availableQuantity must be an integer greater than 0';
  }

  if (!isNonEmptyString(earliestDispatchDate) || !isValidDateOnlyString(earliestDispatchDate)) {
    return 'earliestDispatchDate must be a valid date in YYYY-MM-DD format';
  }

  return null;
};

export const validateCreateInventory = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { productId, warehouseId } = req.body ?? {};

  if (!isNonEmptyString(productId)) {
    next(new AppError('productId is required and must be a non-empty string', 400));
    return;
  }

  if (!isWarehouseId(warehouseId)) {
    next(new AppError(`warehouseId must be one of: ${WAREHOUSE_IDS.join(', ')}`, 400));
    return;
  }

  const bodyError = validateQuantityAndDate(req.body);
  if (bodyError) {
    next(new AppError(bodyError, 400));
    return;
  }

  next();
};

export const validateUpdateInventory = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const bodyError = validateQuantityAndDate(req.body);
  if (bodyError) {
    next(new AppError(bodyError, 400));
    return;
  }

  next();
};

export const validateInventoryIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { inventoryId } = req.params;

  if (!isNonEmptyString(inventoryId)) {
    next(new AppError('inventoryId path parameter is required', 400));
    return;
  }

  next();
};

export const validateProductIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { productId } = req.params;

  if (!isNonEmptyString(productId)) {
    next(new AppError('productId path parameter is required', 400));
    return;
  }

  next();
};

export const validateWarehouseIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { warehouseId } = req.params;

  if (!isWarehouseId(warehouseId)) {
    next(new AppError(`warehouseId path parameter must be one of: ${WAREHOUSE_IDS.join(', ')}`, 400));
    return;
  }

  next();
};

export const validateWarehouseIdQuery = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { warehouseId } = req.query;

  if (warehouseId !== undefined && !isWarehouseId(warehouseId)) {
    next(new AppError(`warehouseId query parameter must be one of: ${WAREHOUSE_IDS.join(', ')}`, 400));
    return;
  }

  next();
};
