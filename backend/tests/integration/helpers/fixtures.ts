import sql from 'mssql';
import { executeQuery } from '../../../src/methods/db.methods';
import { CustomerEligibilityStatus, CustomerType } from '../../../src/utils/customer.types';
import { WarehouseId } from '../../../src/utils/inventory.types';

let counter = 0;

/**
 * Generates a unique id per call so parallel/repeated test runs never
 * collide on primary keys.
 */
export const uniqueId = (prefix: string): string => {
  counter += 1;
  return `${prefix}-${Date.now()}-${process.pid}-${counter}`;
};

export const createTestCustomer = async (params: {
  customerId: string;
  eligibilityStatus: CustomerEligibilityStatus;
  customerType?: CustomerType;
}): Promise<void> => {
  await executeQuery(
    `INSERT INTO dbo.OrdfulCustomers (CustomerId, CustomerName, CustomerType, EligibilityStatus)
     VALUES (@customerId, @customerName, @customerType, @eligibilityStatus);`,
    {
      customerId: { type: sql.NVarChar(50), value: params.customerId },
      customerName: { type: sql.NVarChar(200), value: `Test Customer ${params.customerId}` },
      customerType: { type: sql.NVarChar(20), value: params.customerType ?? 'Standard' },
      eligibilityStatus: { type: sql.NVarChar(20), value: params.eligibilityStatus },
    }
  );
};

export const createTestInventory = async (params: {
  productId: string;
  warehouseId: WarehouseId;
  availableQuantity: number;
  earliestDispatchDate: string;
}): Promise<void> => {
  await executeQuery(
    `INSERT INTO dbo.OrdfulInventory (ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate)
     VALUES (@productId, @warehouseId, @availableQuantity, @earliestDispatchDate);`,
    {
      productId: { type: sql.NVarChar(50), value: params.productId },
      warehouseId: { type: sql.NVarChar(20), value: params.warehouseId },
      availableQuantity: { type: sql.Int, value: params.availableQuantity },
      earliestDispatchDate: {
        type: sql.Date,
        value: new Date(`${params.earliestDispatchDate}T00:00:00.000Z`),
      },
    }
  );
};

export const getInventoryQuantity = async (
  productId: string,
  warehouseId: WarehouseId
): Promise<number | null> => {
  const rows = await executeQuery<{ AvailableQuantity: number }>(
    `SELECT AvailableQuantity FROM dbo.OrdfulInventory WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
    {
      productId: { type: sql.NVarChar(50), value: productId },
      warehouseId: { type: sql.NVarChar(20), value: warehouseId },
    }
  );

  return rows.length > 0 ? rows[0].AvailableQuantity : null;
};

export const countAllocationsForOrder = async (orderId: string): Promise<number> => {
  const rows = await executeQuery<{ Total: number }>(
    `SELECT COUNT(*) AS Total FROM dbo.OrdfulInventoryAllocations WHERE OrderId = @orderId;`,
    { orderId: { type: sql.NVarChar(50), value: orderId } }
  );

  return rows[0]?.Total ?? 0;
};

export const orderExists = async (orderId: string): Promise<boolean> => {
  const rows = await executeQuery<{ OrderId: string }>(
    `SELECT OrderId FROM dbo.OrdfulOrders WHERE OrderId = @orderId;`,
    { orderId: { type: sql.NVarChar(50), value: orderId } }
  );

  return rows.length > 0;
};

/**
 * Deletes an order and everything that references it (allocations, then
 * the fulfilment result, then the order itself), respecting foreign keys.
 */
export const cleanupOrder = async (orderId: string): Promise<void> => {
  await executeQuery(`DELETE FROM dbo.OrdfulInventoryAllocations WHERE OrderId = @orderId;`, {
    orderId: { type: sql.NVarChar(50), value: orderId },
  });
  await executeQuery(`DELETE FROM dbo.OrdfulFulfilmentResults WHERE OrderId = @orderId;`, {
    orderId: { type: sql.NVarChar(50), value: orderId },
  });
  await executeQuery(`DELETE FROM dbo.OrdfulOrders WHERE OrderId = @orderId;`, {
    orderId: { type: sql.NVarChar(50), value: orderId },
  });
};

export const cleanupInventory = async (productId: string): Promise<void> => {
  await executeQuery(`DELETE FROM dbo.OrdfulInventory WHERE ProductId = @productId;`, {
    productId: { type: sql.NVarChar(50), value: productId },
  });
};

export const cleanupCustomer = async (customerId: string): Promise<void> => {
  await executeQuery(`DELETE FROM dbo.OrdfulCustomers WHERE CustomerId = @customerId;`, {
    customerId: { type: sql.NVarChar(50), value: customerId },
  });
};
