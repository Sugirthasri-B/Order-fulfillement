import { useAsync } from './useAsync';
import { useRecentOrders } from './useRecentOrders';
import { getOrder } from '../services/orderService';
import { OrderDetails } from '../types/order';

/**
 * The backend only exposes GET /api/orders/:orderId — there's no "list all
 * orders" endpoint — so the app's only view of "orders" is the order IDs
 * this browser has created or looked up (see useRecentOrders), each
 * enriched with a live GET call. An orderId that no longer resolves (e.g.
 * a stale lookup) is silently dropped rather than shown as broken.
 *
 * Shared by the Orders page (list/search/filter) and the Dashboard
 * (summary stats/charts) so both reflect the same known-orders dataset.
 */
const fetchKnownOrders = async (orderIds: string[]): Promise<OrderDetails[]> => {
  const results = await Promise.all(orderIds.map((id) => getOrder(id)));
  return results.filter((order): order is OrderDetails => order !== null);
};

export const useKnownOrders = () => {
  const { orderIds, remember, forget } = useRecentOrders();
  const query = useAsync(() => fetchKnownOrders(orderIds), [orderIds]);

  return { ...query, orderIds, remember, forget };
};
