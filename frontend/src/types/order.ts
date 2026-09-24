import { CustomerType } from './customer';
import { WarehouseId } from './inventory';

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

export interface FulfilmentResult {
  orderId: string;
  status: OrderStatus;
  reason: string | null;
  releasedQuantity: number;
  backorderQuantity: number;
  allocation: OrderAllocation | null;
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
