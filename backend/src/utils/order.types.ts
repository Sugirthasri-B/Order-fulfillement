import { CustomerType } from './customer.types';
import { WarehouseId } from './inventory.types';

/**
 * Stage 2 / CHANGE1: exact literal casing required by the API contract.
 * "Partially Released" only ever results from a Priority order combining
 * multiple warehouses — a Standard order is always Released or Blocked.
 */
export type OrderStatus = 'Released' | 'Partially Released' | 'Blocked';

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
  backorderedQuantity: number;
  /** null when the order is blocked (no allocation at all). */
  allocations: OrderAllocation[] | null;
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
