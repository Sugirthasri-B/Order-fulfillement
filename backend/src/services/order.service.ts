import { isDuplicateKeyError, withTransaction } from '../methods/db.methods';
import { findCustomerById } from '../methods/customer.methods';
import {
  deductInventory,
  findFulfilmentResultByOrderId,
  findOrderDetailsByOrderId,
  insertFulfilmentResult,
  insertInventoryAllocation,
  insertOrder,
  lockInventoryForProduct,
  WarehouseCandidate,
} from '../methods/order.methods';
import { ELIGIBILITY_BLOCK_REASONS } from '../utils/customer.types';
import { WarehouseId } from '../utils/inventory.types';
import { CreateOrderInput, FulfilmentResultResponse, OrderDetails } from '../utils/order.types';

type WarehouseDecision =
  | { outcome: 'released'; warehouse: WarehouseCandidate }
  | { outcome: 'blocked'; reason: string };

/**
 * The complete requested quantity must come from a single warehouse — never
 * split across warehouses. `candidates` is expected pre-sorted WH-A, WH-B,
 * WH-C (warehouse priority order); the first candidate meeting both the
 * quantity and dispatch-date requirement wins.
 */
export const decideWarehouse = (
  candidates: WarehouseCandidate[],
  quantity: number,
  promisedDeliveryDate: string
): WarehouseDecision => {
  const withEnoughQuantity = candidates.filter((c) => c.availableQuantity >= quantity);

  if (withEnoughQuantity.length === 0) {
    return { outcome: 'blocked', reason: 'insufficient inventory' };
  }

  const meetsDispatchDate = withEnoughQuantity.filter(
    (c) => c.earliestDispatchDate <= promisedDeliveryDate
  );

  if (meetsDispatchDate.length === 0) {
    return { outcome: 'blocked', reason: 'no inventory can meet promised delivery date' };
  }

  return { outcome: 'released', warehouse: meetsDispatchDate[0] };
};

const buildUnpersistedBlockedResult = (
  orderId: string,
  reason: string,
  quantity: number
): FulfilmentResultResponse => ({
  orderId,
  status: 'blocked',
  reason,
  releasedQuantity: 0,
  backorderQuantity: quantity,
  allocation: null,
});

/**
 * Runs `work` and, if it fails because another concurrent request already
 * inserted this orderId, returns that request's (now committed) result
 * instead of erroring — this is what makes order submission idempotent.
 */
const withIdempotentRetry = async (
  orderId: string,
  work: () => Promise<FulfilmentResultResponse>
): Promise<FulfilmentResultResponse> => {
  try {
    return await work();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await findFulfilmentResultByOrderId(orderId);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
};

const persistBlockedOrder = (
  input: CreateOrderInput,
  reason: string
): Promise<FulfilmentResultResponse> =>
  withIdempotentRetry(input.orderId, () =>
    withTransaction(async (exec) => {
      await insertOrder(exec, {
        orderId: input.orderId,
        customerId: input.customerId,
        productId: input.productId,
        quantity: input.quantity,
        promisedDeliveryDate: input.promisedDeliveryDate,
        earliestDispatchDate: null,
        status: 'blocked',
      });

      await insertFulfilmentResult(exec, {
        orderId: input.orderId,
        status: 'blocked',
        warehouseId: null,
        reason,
      });

      return buildUnpersistedBlockedResult(input.orderId, reason, input.quantity);
    })
  );

const attemptFulfilment = (input: CreateOrderInput): Promise<FulfilmentResultResponse> =>
  withIdempotentRetry(input.orderId, () =>
    withTransaction(async (exec) => {
      const candidates = await lockInventoryForProduct(exec, input.productId);
      const decision = decideWarehouse(candidates, input.quantity, input.promisedDeliveryDate);

      if (decision.outcome === 'blocked') {
        await insertOrder(exec, {
          orderId: input.orderId,
          customerId: input.customerId,
          productId: input.productId,
          quantity: input.quantity,
          promisedDeliveryDate: input.promisedDeliveryDate,
          earliestDispatchDate: null,
          status: 'blocked',
        });

        await insertFulfilmentResult(exec, {
          orderId: input.orderId,
          status: 'blocked',
          warehouseId: null,
          reason: decision.reason,
        });

        return buildUnpersistedBlockedResult(input.orderId, decision.reason, input.quantity);
      }

      const warehouseId: WarehouseId = decision.warehouse.warehouseId;

      await insertOrder(exec, {
        orderId: input.orderId,
        customerId: input.customerId,
        productId: input.productId,
        quantity: input.quantity,
        promisedDeliveryDate: input.promisedDeliveryDate,
        earliestDispatchDate: decision.warehouse.earliestDispatchDate,
        status: 'released',
      });

      await insertFulfilmentResult(exec, {
        orderId: input.orderId,
        status: 'released',
        warehouseId,
        reason: null,
      });

      await insertInventoryAllocation(exec, {
        orderId: input.orderId,
        productId: input.productId,
        warehouseId,
        allocatedQuantity: input.quantity,
      });

      await deductInventory(exec, {
        productId: input.productId,
        warehouseId,
        quantity: input.quantity,
      });

      return {
        orderId: input.orderId,
        status: 'released',
        reason: null,
        releasedQuantity: input.quantity,
        backorderQuantity: 0,
        allocation: { warehouseId, allocatedQuantity: input.quantity },
      };
    })
  );

export const submitOrder = async (input: CreateOrderInput): Promise<FulfilmentResultResponse> => {
  const existingResult = await findFulfilmentResultByOrderId(input.orderId);
  if (existingResult) {
    return existingResult;
  }

  const customer = await findCustomerById(input.customerId);
  if (!customer) {
    // No matching Customers row, so an Orders row referencing it would
    // violate the foreign key — report blocked without persisting anything.
    return buildUnpersistedBlockedResult(input.orderId, 'customer not found', input.quantity);
  }

  if (customer.eligibilityStatus === 'credit hold' || customer.eligibilityStatus === 'unknown') {
    const reason = ELIGIBILITY_BLOCK_REASONS[customer.eligibilityStatus] as string;
    return persistBlockedOrder(input, reason);
  }

  return attemptFulfilment(input);
};

export const getOrderDetails = async (orderId: string): Promise<OrderDetails | null> =>
  findOrderDetailsByOrderId(orderId);
