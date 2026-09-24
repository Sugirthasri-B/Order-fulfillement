import sql from 'mssql';
import { executeQuery } from './db.methods';
import { parseDateOnly, toDateOnlyString } from '../utils/dateOnly';
import {
  buildInventoryId,
  CreateInventoryInput,
  InventoryItem,
  UpdateInventoryInput,
  WarehouseId,
} from '../utils/inventory.types';

interface InventoryRow {
  ProductId: string;
  WarehouseId: string;
  AvailableQuantity: number;
  EarliestDispatchDate: Date;
  UpdatedAt: Date;
}

const mapRowToInventoryItem = (row: InventoryRow): InventoryItem => ({
  inventoryId: buildInventoryId(row.ProductId, row.WarehouseId),
  productId: row.ProductId,
  warehouseId: row.WarehouseId as WarehouseId,
  availableQuantity: row.AvailableQuantity,
  earliestDispatchDate: toDateOnlyString(row.EarliestDispatchDate),
  updatedAt: row.UpdatedAt.toISOString(),
});

export const insertInventory = async (input: CreateInventoryInput): Promise<InventoryItem> => {
  const rows = await executeQuery<InventoryRow>(
    `INSERT INTO dbo.OrdfulInventory (ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate)
     OUTPUT INSERTED.ProductId, INSERTED.WarehouseId, INSERTED.AvailableQuantity,
            INSERTED.EarliestDispatchDate, INSERTED.UpdatedAt
     VALUES (@productId, @warehouseId, @availableQuantity, @earliestDispatchDate);`,
    {
      productId: { type: sql.NVarChar(50), value: input.productId },
      warehouseId: { type: sql.NVarChar(20), value: input.warehouseId },
      availableQuantity: { type: sql.Int, value: input.availableQuantity },
      earliestDispatchDate: { type: sql.Date, value: parseDateOnly(input.earliestDispatchDate) },
    }
  );

  return mapRowToInventoryItem(rows[0]);
};

export const updateInventory = async (
  productId: string,
  warehouseId: string,
  input: UpdateInventoryInput
): Promise<InventoryItem | null> => {
  const rows = await executeQuery<InventoryRow>(
    `UPDATE dbo.OrdfulInventory
     SET AvailableQuantity = @availableQuantity,
         EarliestDispatchDate = @earliestDispatchDate,
         UpdatedAt = SYSUTCDATETIME()
     OUTPUT INSERTED.ProductId, INSERTED.WarehouseId, INSERTED.AvailableQuantity,
            INSERTED.EarliestDispatchDate, INSERTED.UpdatedAt
     WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
    {
      productId: { type: sql.NVarChar(50), value: productId },
      warehouseId: { type: sql.NVarChar(20), value: warehouseId },
      availableQuantity: { type: sql.Int, value: input.availableQuantity },
      earliestDispatchDate: { type: sql.Date, value: parseDateOnly(input.earliestDispatchDate) },
    }
  );

  return rows.length > 0 ? mapRowToInventoryItem(rows[0]) : null;
};

export const findInventoryByProductAndWarehouse = async (
  productId: string,
  warehouseId: string
): Promise<InventoryItem | null> => {
  const rows = await executeQuery<InventoryRow>(
    `SELECT ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate, UpdatedAt
     FROM dbo.OrdfulInventory
     WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
    {
      productId: { type: sql.NVarChar(50), value: productId },
      warehouseId: { type: sql.NVarChar(20), value: warehouseId },
    }
  );

  return rows.length > 0 ? mapRowToInventoryItem(rows[0]) : null;
};

export const findInventoryByProductId = async (productId: string): Promise<InventoryItem[]> => {
  const rows = await executeQuery<InventoryRow>(
    `SELECT ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate, UpdatedAt
     FROM dbo.OrdfulInventory
     WHERE ProductId = @productId
     ORDER BY WarehouseId;`,
    {
      productId: { type: sql.NVarChar(50), value: productId },
    }
  );

  return rows.map(mapRowToInventoryItem);
};

export const findInventoryByWarehouseId = async (warehouseId: string): Promise<InventoryItem[]> => {
  const rows = await executeQuery<InventoryRow>(
    `SELECT ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate, UpdatedAt
     FROM dbo.OrdfulInventory
     WHERE WarehouseId = @warehouseId
     ORDER BY ProductId;`,
    {
      warehouseId: { type: sql.NVarChar(20), value: warehouseId },
    }
  );

  return rows.map(mapRowToInventoryItem);
};

export const findAllInventory = async (): Promise<InventoryItem[]> => {
  const rows = await executeQuery<InventoryRow>(
    `SELECT ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate, UpdatedAt
     FROM dbo.OrdfulInventory
     ORDER BY ProductId, WarehouseId;`
  );

  return rows.map(mapRowToInventoryItem);
};
