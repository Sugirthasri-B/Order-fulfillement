import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState, ErrorMessage, Loading, PageHeader } from '../../components';
import { useAsync } from '../../hooks/useAsync';
import { useRecentOrders } from '../../hooks/useRecentOrders';
import { getOrder } from '../../services/orderService';
import { OrderDetailsPanel } from './OrderDetailsPanel';

export const FulfilmentDetailsPage = () => {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const { data, loading, error } = useAsync(() => getOrder(orderId), [orderId]);
  const { remember } = useRecentOrders();

  useEffect(() => {
    if (data) {
      remember(data.orderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="stack">
      <PageHeader title="Fulfilment Details" description={`Current fulfilment result for order ${orderId}.`} />

      {loading && <Loading label="Loading order…" />}
      {error && !loading && <ErrorMessage message={error} />}

      {!loading && !error && data === null && (
        <EmptyState
          icon="🔍"
          title="Order not found"
          description={`There is no order with ID "${orderId}".`}
        />
      )}

      {!loading && !error && data && <OrderDetailsPanel order={data} />}
    </div>
  );
};
