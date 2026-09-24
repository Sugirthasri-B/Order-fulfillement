import sql from 'mssql';
import { executeQuery, TransactionQueryExecutor } from './db.methods';
import { toDateOnlyString } from '../utils/dateOnly';
import { CustomerType } from '../utils/customer.types';
import { WarehouseId } from '../utils/inventory.types';
import { FulfilmentResultResponse, OrderAllocation, OrderDetails, OrderStatus } from '../utils/order.types';

export interface WarehouseCandidate {
  warehouseId: WarehouseId;
  availableQuantity: number;
  earliestDispatchDate: string;
}

interface InventoryLockRow {
  WarehouseId: string;
  AvailableQuantity: number;
  EarliestDispatchDate: Date;
}

/**
 * Reads every warehouse's inventory row for a product, taking an update
 * lock on each row so a concurrent transaction touching the same product
 * blocks until this one commits or rolls back. This is what prevents two
 * concurrent orders from overselling the same warehouse. Rows come back
 * ordered WH-A, WH-B, WH-C, matching the warehouse selection/combination
 * priority for both Standard and Priority customers.
 */
export const lockInventoryForProduct = async (
  exec: TransactionQueryExecutor,
  productId: string
): Promise<WarehouseCandidate[]> => {
  const rows = await exec<InventoryLockRow>(
    `SELECT WarehouseId, AvailableQuantity, EarliestDispatchDate
     FROM dbo.OrdfulInventory WITH (UPDLOCK, ROWLOCK)
     WHERE ProductId = @productId
     ORDER BY WarehouseId ASC;`,
    {
      productId: { type: sql.NVarChar(50), value: productId },
    }
  );

  return rows.map((row) => ({
    warehouseId: row.WarehouseId as WarehouseId,
    availableQuantity: row.AvailableQuantity,
    earliestDispatchDate: toDateOnlyString(row.EarliestDispatchDate),
  }));
};

export const deductInventory = async (
  exec: TransactionQueryExecutor,
  params: { productId: string; warehouseId: WarehouseId; quantity: number }
): Promise<void> => {
  await exec(
    `UPDATE dbo.OrdfulInventory
     SET AvailableQuantity = AvailableQuantity - @quantity, UpdatedAt = SYSUTCDATETIME()
     WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
    {
      productId: { type: sql.NVarChar(50), value: params.productId },
      warehouseId: { type: sql.NVarChar(20), value: params.warehouseId },
      quantity: { type: sql.Int, value: params.quantity },
    }
  );
};

export const insertOrder = async (
  exec: TransactionQueryExecutor,
  order: {
    orderId: string;
    customerId: string;
    productId: string;
    quantity: number;
    promisedDeliveryDate: string;
    /** Only set for a single-warehouse release; null for a multi-warehouse
     *  Priority release or a blocked order. */
    earliestDispatchDate: string | null;
    status: OrderStatus;
  }
): Promise<void> => {
  await exec(
    `INSERT INTO dbo.OrdfulOrders
        (OrderId, CustomerId, ProductId, Quantity, PromisedDeliveryDate, EarliestDispatchDate, OrderStatus)
     VALUES
        (@orderId, @customerId, @productId, @quantity, @promisedDeliveryDate, @earliestDispatchDate, @status);`,
    {
      orderId: { type: sql.NVarChar(50), value: order.orderId },
      customerId: { type: sql.NVarChar(50), value: order.customerId },
      productId: { type: sql.NVarChar(50), value: order.productId },
      quantity: { type: sql.Int, value: order.quantity },
      promisedDeliveryDate: { type: sql.Date, value: new Date(`${order.promisedDeliveryDate}T00:00:00.000Z`) },
      earliestDispatchDate: {
        type: sql.Date,
        value: order.earliestDispatchDate ? new Date(`${order.earliestDispatchDate}T00:00:00.000Z`) : null,
      },
      status: { type: sql.NVarChar(30), value: order.status },
    }
  );
};

export const insertFulfilmentResult = async (
  exec: TransactionQueryExecutor,
  result: {
    orderId: string;
    status: OrderStatus;
    /** Only set when exactly one warehouse was used; null for a
     *  multi-warehouse Priority release or a blocked order. */
    warehouseId: WarehouseId | null;
    reason: string | null;
    releasedQuantity: number;
    backorderedQuantity: number;
  }
): Promise<void> => {
  await exec(
    `INSERT INTO dbo.OrdfulFulfilmentResults
        (OrderId, Status, WarehouseId, Reason, ReleasedQuantity, BackorderedQuantity)
     VALUES
        (@orderId, @status, @warehouseId, @reason, @releasedQuantity, @backorderedQuantity);`,
    {
      orderId: { type: sql.NVarChar(50), value: result.orderId },
      status: { type: sql.NVarChar(30), value: result.status },
      warehouseId: { type: sql.NVarChar(20), value: result.warehouseId },
      reason: { type: sql.NVarChar(500), value: result.reason },
      releasedQuantity: { type: sql.Int, value: result.releasedQuantity },
      backorderedQuantity: { type: sql.Int, value: result.backorderedQuantity },
    }
  );
};

export const insertInventoryAllocation = async (
  exec: TransactionQueryExecutor,
  allocation: {
    orderId: string;
    productId: string;
    warehouseId: WarehouseId;
    allocatedQuantity: number;
  }
): Promise<void> => {
  await exec(
    `INSERT INTO dbo.OrdfulInventoryAllocations (OrderId, ProductId, WarehouseId, AllocatedQuantity)
     VALUES (@orderId, @productId, @warehouseId, @allocatedQuantity);`,
    {
      orderId: { type: sql.NVarChar(50), value: allocation.orderId },
      productId: { type: sql.NVarChar(50), value: allocation.productId },
      warehouseId: { type: sql.NVarChar(20), value: allocation.warehouseId },
      allocatedQuantity: { type: sql.Int, value: allocation.allocatedQuantity },
    }
  );
};

/** Inserts every allocation row for an order, in the given (priority) order. */
export const insertInventoryAllocations = async (
  exec: TransactionQueryExecutor,
  orderId: string,
  productId: string,
  allocations: OrderAllocation[]
): Promise<void> => {
  for (const allocation of allocations) {
    await insertInventoryAllocation(exec, {
      orderId,
      productId,
      warehouseId: allocation.warehouseId,
      allocatedQuantity: allocation.allocatedQuantity,
    });
  }
};

export const insertBackorder = async (
  exec: TransactionQueryExecutor,
  backorder: { orderId: string; productId: string; backorderedQuantity: number }
): Promise<void> => {
  await exec(
    `INSERT INTO dbo.OrdfulBackorders (OrderId, ProductId, BackorderedQuantity, Status)
     VALUES (@orderId, @productId, @backorderedQuantity, 'Open');`,
    {
      orderId: { type: sql.NVarChar(50), value: backorder.orderId },
      productId: { type: sql.NVarChar(50), value: backorder.productId },
      backorderedQuantity: { type: sql.Int, value: backorder.backorderedQuantity },
    }
  );
};

export interface OpenBackorder {
  backorderId: number;
  orderId: string;
  productId: string;
  backorderedQuantity: number;
}

interface OpenBackorderRow {
  BackorderId: number;
  OrderId: string;
  ProductId: string;
  BackorderedQuantity: number;
}

/**
 * Stage 3 / CHANGE2: the single oldest Open backorder for a product,
 * ordered by CreatedAt with OrderId as the tie-breaker when two backorders
 * were created at the same instant. Returns null when there is no open
 * backorder for this product at all.
 */
export const findOldestOpenBackorderForProduct = async (
  exec: TransactionQueryExecutor,
  productId: string
): Promise<OpenBackorder | null> => {
  const rows = await exec<OpenBackorderRow>(
    `SELECT TOP 1 BackorderId, OrderId, ProductId, BackorderedQuantity
     FROM dbo.OrdfulBackorders
     WHERE ProductId = @productId AND Status = 'Open'
     ORDER BY CreatedAt ASC, OrderId ASC;`,
    { productId: { type: sql.NVarChar(50), value: productId } }
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    backorderId: row.BackorderId,
    orderId: row.OrderId,
    productId: row.ProductId,
    backorderedQuantity: row.BackorderedQuantity,
  };
};

/**
 * Stage 3 / CHANGE2: writes a backorder's new remaining quantity and status
 * (Open, still short; Closed, fully covered) after applying newly available
 * inventory to it.
 */
export const updateBackorderAfterApplication = async (
  exec: TransactionQueryExecutor,
  params: { backorderId: number; remainingQuantity: number; status: 'Open' | 'Closed' }
): Promise<void> => {
  await exec(
    `UPDATE dbo.OrdfulBackorders
     SET BackorderedQuantity = @remainingQuantity, Status = @status
     WHERE BackorderId = @backorderId;`,
    {
      backorderId: { type: sql.Int, value: params.backorderId },
      remainingQuantity: { type: sql.Int, value: params.remainingQuantity },
      status: { type: sql.NVarChar(20), value: params.status },
    }
  );
};

/**
 * Stage 3 / CHANGE2: adds `additionalQuantity` to an order's existing
 * allocation for a warehouse (from its original release), or inserts a new
 * allocation row if this order never drew from that warehouse before.
 * Needed because OrdfulInventoryAllocations has a unique (OrderId,
 * ProductId, WarehouseId) constraint — a backorder top-up from the same
 * warehouse the order originally used must increment, not duplicate, that
 * row, while a top-up from a different warehouse still gets its own row.
 */
export const upsertInventoryAllocation = async (
  exec: TransactionQueryExecutor,
  allocation: { orderId: string; productId: string; warehouseId: WarehouseId; additionalQuantity: number }
): Promise<void> => {
  const updatedRows = await exec<{ AllocationId: number }>(
    `UPDATE dbo.OrdfulInventoryAllocations
     SET AllocatedQuantity = AllocatedQuantity + @additionalQuantity
     OUTPUT INSERTED.AllocationId
     WHERE OrderId = @orderId AND ProductId = @productId AND WarehouseId = @warehouseId;`,
    {
      orderId: { type: sql.NVarChar(50), value: allocation.orderId },
      productId: { type: sql.NVarChar(50), value: allocation.productId },
      warehouseId: { type: sql.NVarChar(20), value: allocation.warehouseId },
      additionalQuantity: { type: sql.Int, value: allocation.additionalQuantity },
    }
  );

  if (updatedRows.length > 0) {
    return;
  }

  await insertInventoryAllocation(exec, {
    orderId: allocation.orderId,
    productId: allocation.productId,
    warehouseId: allocation.warehouseId,
    allocatedQuantity: allocation.additionalQuantity,
  });
};

/**
 * Stage 3 / CHANGE2: increases a warehouse's on-hand inventory by the
 * quantity Operations reported as newly available. Whatever portion isn't
 * consumed by a backorder in the same submission is left behind as regular
 * available stock.
 */
export const increaseInventoryQuantity = async (
  exec: TransactionQueryExecutor,
  params: { productId: string; warehouseId: WarehouseId; quantity: number }
): Promise<void> => {
  await exec(
    `UPDATE dbo.OrdfulInventory
     SET AvailableQuantity = AvailableQuantity + @quantity, UpdatedAt = SYSUTCDATETIME()
     WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
    {
      productId: { type: sql.NVarChar(50), value: params.productId },
      warehouseId: { type: sql.NVarChar(20), value: params.warehouseId },
      quantity: { type: sql.Int, value: params.quantity },
    }
  );
};

/**
 * Stage 3 / CHANGE2: rolls a backorder application's effect up onto the
 * parent order's overall released/backordered quantities and status, on
 * both OrdfulFulfilmentResults and OrdfulOrders (kept in sync, exactly as
 * the original order-creation flow always writes both together).
 */
export const applyBackorderReleaseToOrder = async (
  exec: TransactionQueryExecutor,
  params: {
    orderId: string;
    additionalReleasedQuantity: number;
    newBackorderedQuantity: number;
    newStatus: OrderStatus;
  }
): Promise<void> => {
  await exec(
    `UPDATE dbo.OrdfulFulfilmentResults
     SET ReleasedQuantity = ReleasedQuantity + @additionalReleasedQuantity,
         BackorderedQuantity = @newBackorderedQuantity,
         Status = @newStatus
     WHERE OrderId = @orderId;`,
    {
      orderId: { type: sql.NVarChar(50), value: params.orderId },
      additionalReleasedQuantity: { type: sql.Int, value: params.additionalReleasedQuantity },
      newBackorderedQuantity: { type: sql.Int, value: params.newBackorderedQuantity },
      newStatus: { type: sql.NVarChar(30), value: params.newStatus },
    }
  );

  await exec(
    `UPDATE dbo.OrdfulOrders
     SET OrderStatus = @newStatus
     WHERE OrderId = @orderId;`,
    {
      orderId: { type: sql.NVarChar(50), value: params.orderId },
      newStatus: { type: sql.NVarChar(30), value: params.newStatus },
    }
  );
};

interface AllocationRow {
  WarehouseId: string;
  AllocatedQuantity: number;
}

const fetchAllocationsForOrder = async (orderId: string): Promise<OrderAllocation[]> => {
  const rows = await executeQuery<AllocationRow>(
    `SELECT WarehouseId, AllocatedQuantity
     FROM dbo.OrdfulInventoryAllocations
     WHERE OrderId = @orderId
     ORDER BY AllocationId ASC;`,
    { orderId: { type: sql.NVarChar(50), value: orderId } }
  );

  return rows.map((row) => ({
    warehouseId: row.WarehouseId as WarehouseId,
    allocatedQuantity: row.AllocatedQuantity,
  }));
};

interface FulfilmentRow {
  OrderId: string;
  Status: string;
  Reason: string | null;
  ReleasedQuantity: number;
  BackorderedQuantity: number;
}

export const findFulfilmentResultByOrderId = async (
  orderId: string
): Promise<FulfilmentResultResponse | null> => {
  const rows = await executeQuery<FulfilmentRow>(
    `SELECT o.OrderId, fr.Status, fr.Reason, fr.ReleasedQuantity, fr.BackorderedQuantity
     FROM dbo.OrdfulOrders o
     INNER JOIN dbo.OrdfulFulfilmentResults fr ON fr.OrderId = o.OrderId
     WHERE o.OrderId = @orderId;`,
    { orderId: { type: sql.NVarChar(50), value: orderId } }
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const allocations = await fetchAllocationsForOrder(orderId);

  return {
    orderId: row.OrderId,
    status: row.Status as OrderStatus,
    reason: row.Reason,
    releasedQuantity: row.ReleasedQuantity,
    backorderedQuantity: row.BackorderedQuantity,
    allocations: allocations.length > 0 ? allocations : null,
  };
};

interface OrderDetailsRow extends FulfilmentRow {
  CustomerId: string;
  CustomerType: string;
  ProductId: string;
  RequestedQuantity: number;
  PromisedDeliveryDate: Date;
}

/**
 * The richer read behind GET /api/orders/:orderId — includes the order's
 * own request details (customer, product, quantity, promised date)
 * alongside the fulfilment outcome. Not used by POST /api/orders, which
 * always returns the narrower FulfilmentResultResponse via
 * findFulfilmentResultByOrderId above.
 */
export const findOrderDetailsByOrderId = async (orderId: string): Promise<OrderDetails | null> => {
  const rows = await executeQuery<OrderDetailsRow>(
    `SELECT o.OrderId, o.CustomerId, c.CustomerType, o.ProductId,
            o.Quantity AS RequestedQuantity, o.PromisedDeliveryDate,
            fr.Status, fr.Reason, fr.ReleasedQuantity, fr.BackorderedQuantity
     FROM dbo.OrdfulOrders o
     INNER JOIN dbo.OrdfulFulfilmentResults fr ON fr.OrderId = o.OrderId
     LEFT JOIN dbo.OrdfulCustomers c ON c.CustomerId = o.CustomerId
     WHERE o.OrderId = @orderId;`,
    { orderId: { type: sql.NVarChar(50), value: orderId } }
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const allocations = await fetchAllocationsForOrder(orderId);

  return {
    orderId: row.OrderId,
    status: row.Status as OrderStatus,
    reason: row.Reason,
    releasedQuantity: row.ReleasedQuantity,
    backorderedQuantity: row.BackorderedQuantity,
    allocations: allocations.length > 0 ? allocations : null,
    customerId: row.CustomerId,
    customerType: row.CustomerType as CustomerType,
    productId: row.ProductId,
    quantity: row.RequestedQuantity,
    promisedDeliveryDate: toDateOnlyString(row.PromisedDeliveryDate),
  };
};
