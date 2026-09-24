import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import {
  CUSTOMER_TYPES,
  CustomerType,
  ELIGIBILITY_STATUSES,
  CustomerEligibilityStatus,
} from '../utils/customer.types';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Validates the customerName/customerType/eligibilityStatus fields shared
 * by create and update. Returns an error message, or null if valid.
 */
const validateCustomerBody = (body: unknown): string | null => {
  const { customerName, customerType, eligibilityStatus } = (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(customerName)) {
    return 'customerName is required and must be a non-empty string';
  }

  if (!isNonEmptyString(customerType) || !CUSTOMER_TYPES.includes(customerType as CustomerType)) {
    return `customerType must be one of: ${CUSTOMER_TYPES.join(', ')}`;
  }

  if (
    !isNonEmptyString(eligibilityStatus) ||
    !ELIGIBILITY_STATUSES.includes(eligibilityStatus as CustomerEligibilityStatus)
  ) {
    return `eligibilityStatus must be one of: ${ELIGIBILITY_STATUSES.join(', ')}`;
  }

  return null;
};

export const validateCreateCustomer = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { customerId } = req.body ?? {};

  if (!isNonEmptyString(customerId)) {
    next(new AppError('customerId is required and must be a non-empty string', 400));
    return;
  }

  const bodyError = validateCustomerBody(req.body);
  if (bodyError) {
    next(new AppError(bodyError, 400));
    return;
  }

  next();
};

export const validateUpdateCustomer = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const bodyError = validateCustomerBody(req.body);
  if (bodyError) {
    next(new AppError(bodyError, 400));
    return;
  }

  next();
};

export const validateCustomerIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { customerId } = req.params;

  if (!isNonEmptyString(customerId)) {
    next(new AppError('customerId path parameter is required', 400));
    return;
  }

  next();
};
