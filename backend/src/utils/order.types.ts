import { CustomerType } from './customer.types';
import { WarehouseId } from './inventory.types';

export type OrderStatus = 'released' | 'partially released' | 'blocked';

export interface CreateOrderInput {
  orderId: string;
  customerId: string;
  customerType: CustomerType;
  productId: string;
  quantity: number;
  promisedDeliveryDate: string;
}

export interface OrderAllocation {
  warehouseId: WarehouseId;
  allocatedQuantity: number;
}

export interface FulfilmentResultResponse {
  orderId: string;
  status: OrderStatus;
  reason: string | null;
  releasedQuantity: number;
  backorderQuantity: number;
  allocation: OrderAllocation | null;
}

/**
 * The richer view used by GET /api/orders/:orderId (the Fulfilment Details
 * page) — everything in FulfilmentResultResponse plus the order's own
 * request details. POST /api/orders always returns the narrower
 * FulfilmentResultResponse shape, unchanged.
 */
export interface OrderDetails extends FulfilmentResultResponse {
  customerId: string;
  customerType: CustomerType;
  productId: string;
  quantity: number;
  promisedDeliveryDate: string;
}
