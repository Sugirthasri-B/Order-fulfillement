import sql from 'mssql';
import { executeQuery, TransactionQueryExecutor } from './db.methods';
import { toDateOnlyString } from '../utils/dateOnly';
import { CustomerType } from '../utils/customer.types';
import { WarehouseId } from '../utils/inventory.types';
import { FulfilmentResultResponse, OrderDetails, OrderStatus } from '../utils/order.types';

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
 * ordered WH-A, WH-B, WH-C, matching the warehouse selection priority.
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
    warehouseId: WarehouseId | null;
    reason: string | null;
  }
): Promise<void> => {
  await exec(
    `INSERT INTO dbo.OrdfulFulfilmentResults (OrderId, Status, WarehouseId, Reason)
     VALUES (@orderId, @status, @warehouseId, @reason);`,
    {
      orderId: { type: sql.NVarChar(50), value: result.orderId },
      status: { type: sql.NVarChar(30), value: result.status },
      warehouseId: { type: sql.NVarChar(20), value: result.warehouseId },
      reason: { type: sql.NVarChar(500), value: result.reason },
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

interface FulfilmentRow {
  OrderId: string;
  RequestedQuantity: number;
  Status: string;
  Reason: string | null;
  AllocationWarehouseId: string | null;
  AllocatedQuantity: number | null;
}

const mapRowToFulfilmentResult = (row: FulfilmentRow): FulfilmentResultResponse => {
  const releasedQuantity = row.AllocatedQuantity ?? 0;

  return {
    orderId: row.OrderId,
    status: row.Status as OrderStatus,
    reason: row.Reason,
    releasedQuantity,
    backorderQuantity: row.RequestedQuantity - releasedQuantity,
    allocation:
      row.AllocationWarehouseId !== null && row.AllocatedQuantity !== null
        ? {
            warehouseId: row.AllocationWarehouseId as WarehouseId,
            allocatedQuantity: row.AllocatedQuantity,
          }
        : null,
  };
};

export const findFulfilmentResultByOrderId = async (
  orderId: string
): Promise<FulfilmentResultResponse | null> => {
  const rows = await executeQuery<FulfilmentRow>(
    `SELECT o.OrderId, o.Quantity AS RequestedQuantity, fr.Status, fr.Reason,
            ia.WarehouseId AS AllocationWarehouseId, ia.AllocatedQuantity
     FROM dbo.OrdfulOrders o
     INNER JOIN dbo.OrdfulFulfilmentResults fr ON fr.OrderId = o.OrderId
     LEFT JOIN dbo.OrdfulInventoryAllocations ia ON ia.OrderId = o.OrderId
     WHERE o.OrderId = @orderId;`,
    {
      orderId: { type: sql.NVarChar(50), value: orderId },
    }
  );

  return rows.length > 0 ? mapRowToFulfilmentResult(rows[0]) : null;
};

interface OrderDetailsRow extends FulfilmentRow {
  CustomerId: string;
  CustomerType: string;
  ProductId: string;
  PromisedDeliveryDate: Date;
}

const mapRowToOrderDetails = (row: OrderDetailsRow): OrderDetails => ({
  ...mapRowToFulfilmentResult(row),
  customerId: row.CustomerId,
  customerType: row.CustomerType as CustomerType,
  productId: row.ProductId,
  quantity: row.RequestedQuantity,
  promisedDeliveryDate: toDateOnlyString(row.PromisedDeliveryDate),
});

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
            fr.Status, fr.Reason,
            ia.WarehouseId AS AllocationWarehouseId, ia.AllocatedQuantity
     FROM dbo.OrdfulOrders o
     INNER JOIN dbo.OrdfulFulfilmentResults fr ON fr.OrderId = o.OrderId
     LEFT JOIN dbo.OrdfulCustomers c ON c.CustomerId = o.CustomerId
     LEFT JOIN dbo.OrdfulInventoryAllocations ia ON ia.OrderId = o.OrderId
     WHERE o.OrderId = @orderId;`,
    {
      orderId: { type: sql.NVarChar(50), value: orderId },
    }
  );

  return rows.length > 0 ? mapRowToOrderDetails(rows[0]) : null;
};
