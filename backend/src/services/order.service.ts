import { env } from '../config/env';
import { isDuplicateKeyError, withTransaction } from '../methods/db.methods';
import { findCustomerById } from '../methods/customer.methods';
import {
  deductInventory,
  findFulfilmentResultByOrderId,
  findOrderDetailsByOrderId,
  insertBackorder,
  insertFulfilmentResult,
  insertInventoryAllocations,
  insertOrder,
  lockInventoryForProduct,
  WarehouseCandidate,
} from '../methods/order.methods';
import { ELIGIBILITY_BLOCK_REASONS } from '../utils/customer.types';
import { WarehouseId } from '../utils/inventory.types';
import { CreateOrderInput, FulfilmentResultResponse, OrderAllocation, OrderDetails } from '../utils/order.types';

type WarehouseDecision =
  | { outcome: 'released'; warehouse: WarehouseCandidate }
  | { outcome: 'blocked'; reason: string };

/**
 * Standard customers: the complete requested quantity must come from a
 * single warehouse — never split across warehouses. `candidates` is
 * expected pre-sorted WH-A, WH-B, WH-C (warehouse priority order); the
 * first candidate meeting both the quantity and dispatch-date requirement
 * wins.
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

export interface PriorityAllocationDecision {
  outcome: 'released' | 'partially-released' | 'blocked';
  releasedQuantity: number;
  backorderedQuantity: number;
  allocations: OrderAllocation[];
  reason?: string;
}

/**
 * Priority customers (Stage 2 / CHANGE1): inventory may be combined across
 * WH-A, WH-B, WH-C, taken in that order — never more than requested.
 *
 *  - If the full quantity is available, the order is fully released.
 *  - Otherwise, if at least `thresholdPercent`% of the requested quantity
 *    is available, release what's available and leave the rest on
 *    backorder ("Partially Released"). Exactly the threshold qualifies.
 *  - Otherwise, block with no allocation and no backorder.
 *
 * The threshold check uses integer arithmetic
 * (releasedQuantity * 100 >= quantity * thresholdPercent) rather than a
 * floating-point fraction, so the "exactly N% qualifies" boundary can
 * never be missed by floating-point rounding.
 *
 * A warehouse whose earliestDispatchDate is after promisedDeliveryDate is
 * excluded from "available" stock, consistent with the Standard-customer
 * dispatch-date rule from Stage 1.
 */
export const decidePriorityAllocation = (
  candidates: WarehouseCandidate[],
  quantity: number,
  promisedDeliveryDate: string,
  thresholdPercent: number
): PriorityAllocationDecision => {
  const eligible = candidates.filter((c) => c.earliestDispatchDate <= promisedDeliveryDate);

  let remaining = quantity;
  const allocations: OrderAllocation[] = [];

  for (const candidate of eligible) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(candidate.availableQuantity, remaining);
    if (take > 0) {
      allocations.push({ warehouseId: candidate.warehouseId, allocatedQuantity: take });
      remaining -= take;
    }
  }

  const releasedQuantity = quantity - remaining;
  const backorderedQuantity = remaining;

  if (releasedQuantity === quantity) {
    return { outcome: 'released', releasedQuantity, backorderedQuantity: 0, allocations };
  }

  const meetsThreshold = releasedQuantity * 100 >= quantity * thresholdPercent;

  if (meetsThreshold) {
    return { outcome: 'partially-released', releasedQuantity, backorderedQuantity, allocations };
  }

  return {
    outcome: 'blocked',
    releasedQuantity: 0,
    backorderedQuantity: quantity,
    allocations: [],
    reason: 'insufficient inventory',
  };
};

const buildUnpersistedBlockedResult = (
  orderId: string,
  reason: string,
  quantity: number
): FulfilmentResultResponse => ({
  orderId,
  status: 'Blocked',
  reason,
  releasedQuantity: 0,
  backorderedQuantity: quantity,
  allocations: null,
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
        status: 'Blocked',
      });

      await insertFulfilmentResult(exec, {
        orderId: input.orderId,
        status: 'Blocked',
        warehouseId: null,
        reason,
        releasedQuantity: 0,
        backorderedQuantity: input.quantity,
      });

      return buildUnpersistedBlockedResult(input.orderId, reason, input.quantity);
    })
  );

/** The single warehouse's dispatch date, only when exactly one warehouse was used. */
const singleWarehouseDispatchDate = (
  candidates: WarehouseCandidate[],
  allocations: OrderAllocation[]
): string | null => {
  if (allocations.length !== 1) {
    return null;
  }
  return candidates.find((c) => c.warehouseId === allocations[0].warehouseId)?.earliestDispatchDate ?? null;
};

/** Standard customers: full quantity from exactly one warehouse, or blocked. */
const attemptStandardFulfilment = (input: CreateOrderInput): Promise<FulfilmentResultResponse> =>
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
          status: 'Blocked',
        });

        await insertFulfilmentResult(exec, {
          orderId: input.orderId,
          status: 'Blocked',
          warehouseId: null,
          reason: decision.reason,
          releasedQuantity: 0,
          backorderedQuantity: input.quantity,
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
        status: 'Released',
      });

      await insertFulfilmentResult(exec, {
        orderId: input.orderId,
        status: 'Released',
        warehouseId,
        reason: null,
        releasedQuantity: input.quantity,
        backorderedQuantity: 0,
      });

      await insertInventoryAllocations(exec, input.orderId, input.productId, [
        { warehouseId, allocatedQuantity: input.quantity },
      ]);

      await deductInventory(exec, {
        productId: input.productId,
        warehouseId,
        quantity: input.quantity,
      });

      return {
        orderId: input.orderId,
        status: 'Released',
        reason: null,
        releasedQuantity: input.quantity,
        backorderedQuantity: 0,
        allocations: [{ warehouseId, allocatedQuantity: input.quantity }],
      };
    })
  );

/** Priority customers: may combine WH-A/WH-B/WH-C and be partially released. */
const attemptPriorityFulfilment = (input: CreateOrderInput): Promise<FulfilmentResultResponse> =>
  withIdempotentRetry(input.orderId, () =>
    withTransaction(async (exec) => {
      const candidates = await lockInventoryForProduct(exec, input.productId);
      const decision = decidePriorityAllocation(
        candidates,
        input.quantity,
        input.promisedDeliveryDate,
        env.priorityPartialReleaseThresholdPercent
      );

      if (decision.outcome === 'blocked') {
        await insertOrder(exec, {
          orderId: input.orderId,
          customerId: input.customerId,
          productId: input.productId,
          quantity: input.quantity,
          promisedDeliveryDate: input.promisedDeliveryDate,
          earliestDispatchDate: null,
          status: 'Blocked',
        });

        await insertFulfilmentResult(exec, {
          orderId: input.orderId,
          status: 'Blocked',
          warehouseId: null,
          reason: decision.reason ?? 'insufficient inventory',
          releasedQuantity: 0,
          backorderedQuantity: input.quantity,
        });

        return buildUnpersistedBlockedResult(
          input.orderId,
          decision.reason ?? 'insufficient inventory',
          input.quantity
        );
      }

      const status = decision.outcome === 'released' ? 'Released' : 'Partially Released';
      const warehouseId =
        decision.allocations.length === 1 ? decision.allocations[0].warehouseId : null;

      await insertOrder(exec, {
        orderId: input.orderId,
        customerId: input.customerId,
        productId: input.productId,
        quantity: input.quantity,
        promisedDeliveryDate: input.promisedDeliveryDate,
        earliestDispatchDate: singleWarehouseDispatchDate(candidates, decision.allocations),
        status,
      });

      await insertFulfilmentResult(exec, {
        orderId: input.orderId,
        status,
        warehouseId,
        reason: null,
        releasedQuantity: decision.releasedQuantity,
        backorderedQuantity: decision.backorderedQuantity,
      });

      await insertInventoryAllocations(exec, input.orderId, input.productId, decision.allocations);

      for (const allocation of decision.allocations) {
        await deductInventory(exec, {
          productId: input.productId,
          warehouseId: allocation.warehouseId,
          quantity: allocation.allocatedQuantity,
        });
      }

      if (decision.outcome === 'partially-released') {
        await insertBackorder(exec, {
          orderId: input.orderId,
          productId: input.productId,
          backorderedQuantity: decision.backorderedQuantity,
        });
      }

      return {
        orderId: input.orderId,
        status,
        reason: null,
        releasedQuantity: decision.releasedQuantity,
        backorderedQuantity: decision.backorderedQuantity,
        allocations: decision.allocations,
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

  return input.customerType === 'Priority'
    ? attemptPriorityFulfilment(input)
    : attemptStandardFulfilment(input);
};

export const getOrderDetails = async (orderId: string): Promise<OrderDetails | null> =>
  findOrderDetailsByOrderId(orderId);
