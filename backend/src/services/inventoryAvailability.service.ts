import { AppError } from '../utils/AppError';
import { withTransaction } from '../methods/db.methods';
import { findInventoryByProductAndWarehouse } from '../methods/inventory.methods';
import {
  applyBackorderReleaseToOrder,
  deductInventory,
  findOldestOpenBackorderForProduct,
  increaseInventoryQuantity,
  updateBackorderAfterApplication,
  upsertInventoryAllocation,
} from '../methods/order.methods';
import { OrderStatus } from '../utils/order.types';
import { InventoryAvailabilityInput, InventoryAvailabilityResult } from '../utils/inventoryAvailability.types';

export interface BackorderApplicationDecision {
  allocatedQuantity: number;
  remainingBackorderedQuantity: number;
  backorderStatus: 'Open' | 'Closed';
}

/**
 * Stage 3 / CHANGE2: decides how much of newly available inventory to apply
 * to a single backorder's remaining quantity.
 *
 *  - Never allocates more than the backorder's own remaining quantity, even
 *    when more inventory than that was reported available — the surplus is
 *    simply left behind as regular on-hand stock (see
 *    increaseInventoryQuantity / recordInventoryAvailability below).
 *  - Full coverage closes the backorder (remaining quantity 0).
 *  - Partial coverage reduces the remaining quantity and keeps it Open.
 */
export const decideBackorderApplication = (
  remainingBackorderedQuantity: number,
  availableQuantity: number
): BackorderApplicationDecision => {
  const allocatedQuantity = Math.min(remainingBackorderedQuantity, availableQuantity);
  const remainingQuantity = remainingBackorderedQuantity - allocatedQuantity;

  return {
    allocatedQuantity,
    remainingBackorderedQuantity: remainingQuantity,
    backorderStatus: remainingQuantity === 0 ? 'Closed' : 'Open',
  };
};

/**
 * Stage 3 / CHANGE2: POST /api/inventory-availability's entry point.
 * Records newly available inventory for a product/warehouse, then applies
 * it — one submission, one backorder — to the single oldest Open backorder
 * for that productId (CreatedAt ascending, OrderId tie-break). Duplicate
 * submission / concurrency handling is explicitly not required for this
 * endpoint (unlike order creation's UPDLOCK + idempotent-retry handling).
 *
 * Stage 1 (Standard orders) and Stage 2/CHANGE1 (Priority orders) are
 * completely untouched by this — this only ever updates an *existing*
 * Open backorder row that Stage 2 already created.
 */
export const recordInventoryAvailability = async (
  input: InventoryAvailabilityInput
): Promise<InventoryAvailabilityResult> => {
  const existingInventory = await findInventoryByProductAndWarehouse(input.productId, input.warehouseId);

  if (!existingInventory) {
    throw new AppError(
      `Inventory for product '${input.productId}' at warehouse '${input.warehouseId}' not found — create it via POST /api/inventory first`,
      404
    );
  }

  return withTransaction(async (exec) => {
    await increaseInventoryQuantity(exec, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.availableQuantity,
    });

    const backorder = await findOldestOpenBackorderForProduct(exec, input.productId);

    if (!backorder) {
      return {
        productId: input.productId,
        warehouseId: input.warehouseId,
        availableQuantity: input.availableQuantity,
        backorderApplied: false,
        orderId: null,
        allocatedQuantity: 0,
        backorderedQuantity: null,
        backorderStatus: 'NoOpenBackorder',
        orderStatus: null,
        message: `Recorded ${input.availableQuantity} additional unit(s) for product '${input.productId}' at ${input.warehouseId}. No open backorder exists for this product, so nothing was applied.`,
      };
    }

    const decision = decideBackorderApplication(backorder.backorderedQuantity, input.availableQuantity);

    await deductInventory(exec, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: decision.allocatedQuantity,
    });

    await upsertInventoryAllocation(exec, {
      orderId: backorder.orderId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      additionalQuantity: decision.allocatedQuantity,
    });

    await updateBackorderAfterApplication(exec, {
      backorderId: backorder.backorderId,
      remainingQuantity: decision.remainingBackorderedQuantity,
      status: decision.backorderStatus,
    });

    const newOrderStatus: OrderStatus =
      decision.backorderStatus === 'Closed' ? 'Released' : 'Partially Released';

    await applyBackorderReleaseToOrder(exec, {
      orderId: backorder.orderId,
      additionalReleasedQuantity: decision.allocatedQuantity,
      newBackorderedQuantity: decision.remainingBackorderedQuantity,
      newStatus: newOrderStatus,
    });

    return {
      productId: input.productId,
      warehouseId: input.warehouseId,
      availableQuantity: input.availableQuantity,
      backorderApplied: true,
      orderId: backorder.orderId,
      allocatedQuantity: decision.allocatedQuantity,
      backorderedQuantity: decision.remainingBackorderedQuantity,
      backorderStatus: decision.backorderStatus,
      orderStatus: newOrderStatus,
      message:
        decision.backorderStatus === 'Closed'
          ? `Applied ${decision.allocatedQuantity} unit(s) to order '${backorder.orderId}', fully covering its backorder. Backorder closed.`
          : `Applied ${decision.allocatedQuantity} unit(s) to order '${backorder.orderId}'. ${decision.remainingBackorderedQuantity} unit(s) still backordered.`,
    };
  });
};
