import axios from 'axios';
import { apiClient } from './apiClient';
import { CreateOrderInput, FulfilmentResult, OrderDetails } from '../types/order';

export const submitOrder = async (input: CreateOrderInput): Promise<FulfilmentResult> => {
  const { data } = await apiClient.post<FulfilmentResult>('/api/orders', input);
  return data;
};

/**
 * Returns the order's full details (fulfilment outcome + the order's own
 * request info), or `null` if the order does not exist (a 404 from the
 * API) — any other failure is rethrown so the caller can show a real error
 * state instead of a false "not found".
 */
export const getOrder = async (orderId: string): Promise<OrderDetails | null> => {
  try {
    const { data } = await apiClient.get<OrderDetails>(`/api/orders/${orderId}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};
