import { CustomerType } from './customer';
import { WarehouseId } from './inventory';

/** Stage 2 / CHANGE1: exact literal casing required by the API contract. */
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

export interface FulfilmentResult {
  orderId: string;
  status: OrderStatus;
  reason: string | null;
  releasedQuantity: number;
  backorderedQuantity: number;
  /** null when the order is blocked (no allocation at all). A Priority
   *  order may have more than one entry when it combines warehouses. */
  allocations: OrderAllocation[] | null;
}

/**
 * The richer shape returned by GET /api/orders/:orderId — everything in
 * FulfilmentResult plus the order's own request details, for the Fulfilment
 * Details page and the Orders list.
 */
export interface OrderDetails extends FulfilmentResult {
  customerId: string;
  customerType: CustomerType;
  productId: string;
  quantity: number;
  promisedDeliveryDate: string;
}
