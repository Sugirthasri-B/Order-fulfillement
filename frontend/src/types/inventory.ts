export type WarehouseId = 'WH-A' | 'WH-B' | 'WH-C';

export const WAREHOUSE_IDS: readonly WarehouseId[] = ['WH-A', 'WH-B', 'WH-C'];

export interface InventoryItem {
  inventoryId: string;
  productId: string;
  warehouseId: WarehouseId;
  availableQuantity: number;
  earliestDispatchDate: string;
  updatedAt: string;
}

export interface CreateInventoryInput {
  productId: string;
  warehouseId: WarehouseId;
  availableQuantity: number;
  earliestDispatchDate: string;
}

export interface UpdateInventoryInput {
  availableQuantity: number;
  earliestDispatchDate: string;
}
