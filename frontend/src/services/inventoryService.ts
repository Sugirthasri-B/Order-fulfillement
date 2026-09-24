import { apiClient } from './apiClient';
import { ApiEnvelope } from '../types/api';
import { CreateInventoryInput, InventoryItem, UpdateInventoryInput } from '../types/inventory';

export const getAllInventory = async (): Promise<InventoryItem[]> => {
  const { data } = await apiClient.get<ApiEnvelope<InventoryItem[]>>('/api/inventory');
  return data.data;
};

export const getInventoryByProductId = async (
  productId: string,
  warehouseId?: string
): Promise<InventoryItem | InventoryItem[]> => {
  const { data } = await apiClient.get<ApiEnvelope<InventoryItem | InventoryItem[]>>(
    `/api/inventory/product/${productId}`,
    { params: warehouseId ? { warehouseId } : undefined }
  );
  return data.data;
};

export const getInventoryByWarehouseId = async (warehouseId: string): Promise<InventoryItem[]> => {
  const { data } = await apiClient.get<ApiEnvelope<InventoryItem[]>>(
    `/api/inventory/warehouse/${warehouseId}`
  );
  return data.data;
};

export const createInventory = async (input: CreateInventoryInput): Promise<InventoryItem> => {
  const { data } = await apiClient.post<ApiEnvelope<InventoryItem>>('/api/inventory', input);
  return data.data;
};

export const updateInventory = async (
  inventoryId: string,
  input: UpdateInventoryInput
): Promise<InventoryItem> => {
  const { data } = await apiClient.put<ApiEnvelope<InventoryItem>>(
    `/api/inventory/${encodeURIComponent(inventoryId)}`,
    input
  );
  return data.data;
};
