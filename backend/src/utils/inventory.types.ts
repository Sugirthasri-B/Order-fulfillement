export type WarehouseId = 'WH-A' | 'WH-B' | 'WH-C';

export const WAREHOUSE_IDS: readonly WarehouseId[] = ['WH-A', 'WH-B', 'WH-C'];

export interface InventoryItem {
  /** Opaque composite id ("<productId>::<warehouseId>") — Inventory's real key is the pair. */
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

const INVENTORY_ID_SEPARATOR = '::';

export const buildInventoryId = (productId: string, warehouseId: string): string =>
  `${productId}${INVENTORY_ID_SEPARATOR}${warehouseId}`;

/**
 * Splits an inventoryId back into its productId/warehouseId parts, taking
 * the LAST separator so a productId that happens to contain "::" is still
 * parsed correctly (warehouseId itself never contains the separator).
 */
export const parseInventoryId = (
  inventoryId: string
): { productId: string; warehouseId: string } | null => {
  const separatorIndex = inventoryId.lastIndexOf(INVENTORY_ID_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === inventoryId.length - INVENTORY_ID_SEPARATOR.length) {
    return null;
  }

  return {
    productId: inventoryId.slice(0, separatorIndex),
    warehouseId: inventoryId.slice(separatorIndex + INVENTORY_ID_SEPARATOR.length),
  };
};
