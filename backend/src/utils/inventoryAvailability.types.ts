import { WarehouseId } from './inventory.types';
import { OrderStatus } from './order.types';

export interface InventoryAvailabilityInput {
  productId: string;
  warehouseId: WarehouseId;
  availableQuantity: number;
}

/**
 * Stage 3 / CHANGE2: the backorder outcome reported back by
 * POST /api/inventory-availability is exactly one of these three literal
 * values — 'Open' and 'Closed' are real OrdfulBackorders.Status values,
 * 'NoOpenBackorder' means the submission was recorded but no open backorder
 * existed for the product to apply it to.
 */
export type BackorderStatus = 'Open' | 'Closed' | 'NoOpenBackorder';

export interface InventoryAvailabilityResult {
  productId: string;
  warehouseId: WarehouseId;
  availableQuantity: number;
  /** false when no open backorder exists for productId — inventory was still recorded. */
  backorderApplied: boolean;
  orderId: string | null;
  allocatedQuantity: number;
  backorderedQuantity: number | null;
  backorderStatus: BackorderStatus;
  orderStatus: OrderStatus | null;
  message: string;
}
