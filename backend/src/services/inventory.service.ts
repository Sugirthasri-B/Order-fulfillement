import { AppError } from '../utils/AppError';
import {
  CreateInventoryInput,
  InventoryItem,
  parseInventoryId,
  UpdateInventoryInput,
} from '../utils/inventory.types';
import {
  findAllInventory,
  findInventoryByProductAndWarehouse,
  findInventoryByProductId,
  findInventoryByWarehouseId,
  insertInventory,
  updateInventory as updateInventoryRow,
} from '../methods/inventory.methods';

export const createInventory = async (input: CreateInventoryInput): Promise<InventoryItem> => {
  const existingItem = await findInventoryByProductAndWarehouse(input.productId, input.warehouseId);

  if (existingItem) {
    throw new AppError(
      `Inventory for product '${input.productId}' at warehouse '${input.warehouseId}' already exists`,
      409
    );
  }

  return insertInventory(input);
};

export const getAllInventory = async (): Promise<InventoryItem[]> => {
  return findAllInventory();
};

export const getInventoryByProductId = async (
  productId: string,
  warehouseId?: string
): Promise<InventoryItem | InventoryItem[]> => {
  if (warehouseId) {
    const item = await findInventoryByProductAndWarehouse(productId, warehouseId);

    if (!item) {
      throw new AppError(
        `Inventory for product '${productId}' at warehouse '${warehouseId}' not found`,
        404
      );
    }

    return item;
  }

  const items = await findInventoryByProductId(productId);

  if (items.length === 0) {
    throw new AppError(`Inventory for product '${productId}' not found`, 404);
  }

  return items;
};

export const getInventoryByWarehouseId = async (warehouseId: string): Promise<InventoryItem[]> => {
  const items = await findInventoryByWarehouseId(warehouseId);

  if (items.length === 0) {
    throw new AppError(`No inventory found for warehouse '${warehouseId}'`, 404);
  }

  return items;
};

export const updateInventory = async (
  inventoryId: string,
  input: UpdateInventoryInput
): Promise<InventoryItem> => {
  const parsed = parseInventoryId(inventoryId);

  if (!parsed) {
    throw new AppError(`Invalid inventoryId '${inventoryId}'`, 400);
  }

  const updated = await updateInventoryRow(parsed.productId, parsed.warehouseId, input);

  if (!updated) {
    throw new AppError(`Inventory '${inventoryId}' not found`, 404);
  }

  return updated;
};
