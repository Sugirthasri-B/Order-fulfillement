import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { CUSTOMER_TYPES, CustomerType } from '../utils/customer.types';
import { isValidDateOnlyString } from '../utils/dateOnly';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const validateCreateOrder = (req: Request, _res: Response, next: NextFunction): void => {
  const { orderId, customerId, customerType, productId, quantity, promisedDeliveryDate } =
    req.body ?? {};

  if (!isNonEmptyString(orderId)) {
    next(new AppError('orderId is required and must be a non-empty string', 400));
    return;
  }

  if (!isNonEmptyString(customerId)) {
    next(new AppError('customerId is required and must be a non-empty string', 400));
    return;
  }

  if (!isNonEmptyString(customerType) || !CUSTOMER_TYPES.includes(customerType as CustomerType)) {
    next(new AppError(`customerType must be one of: ${CUSTOMER_TYPES.join(', ')}`, 400));
    return;
  }

  if (!isNonEmptyString(productId)) {
    next(new AppError('productId is required and must be a non-empty string', 400));
    return;
  }

  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    next(new AppError('quantity must be an integer greater than 0', 400));
    return;
  }

  if (!isNonEmptyString(promisedDeliveryDate) || !isValidDateOnlyString(promisedDeliveryDate)) {
    next(new AppError('promisedDeliveryDate must be a valid date in YYYY-MM-DD format', 400));
    return;
  }

  next();
};

export const validateOrderIdParam = (req: Request, _res: Response, next: NextFunction): void => {
  const { orderId } = req.params;

  if (!isNonEmptyString(orderId)) {
    next(new AppError('orderId path parameter is required', 400));
    return;
  }

  next();
};
