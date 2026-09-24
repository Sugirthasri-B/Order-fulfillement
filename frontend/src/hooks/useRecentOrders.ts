import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'order-fulfilment:recent-order-ids';
const MAX_ENTRIES = 25;

const readStoredIds = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const writeStoredIds = (ids: string[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Browser storage is unavailable (private mode, quota, etc.) — the app
    // still works, it just won't remember order IDs across visits.
  }
};

/**
 * The backend only exposes GET /api/orders/:orderId, not a "list all
 * orders" endpoint, so the Orders page remembers order IDs the user has
 * created or looked up on this device. This is purely a lookup aid — the
 * actual status shown for any order always comes from a live API call.
 */
export const useRecentOrders = () => {
  const [orderIds, setOrderIds] = useState<string[]>(() => readStoredIds());

  useEffect(() => {
    writeStoredIds(orderIds);
  }, [orderIds]);

  const remember = useCallback((orderId: string) => {
    setOrderIds((prev) => [orderId, ...prev.filter((id) => id !== orderId)].slice(0, MAX_ENTRIES));
  }, []);

  const forget = useCallback((orderId: string) => {
    setOrderIds((prev) => prev.filter((id) => id !== orderId));
  }, []);

  return { orderIds, remember, forget };
};
