import { StatusBadge } from '../../components';
import { OrderDetails } from '../../types/order';
import { formatDate } from '../../utils/format';

export interface OrderDetailsPanelProps {
  order: OrderDetails;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="result-panel__row">
    <span className="result-panel__label">{label}</span>
    <span className="result-panel__value">{value}</span>
  </div>
);

const formatAllocations = (order: OrderDetails): string =>
  order.allocations && order.allocations.length > 0
    ? order.allocations.map((a) => `${a.warehouseId} — ${a.allocatedQuantity.toLocaleString()} units`).join(', ')
    : '—';

/**
 * The full Fulfilment Details view. Released, Partially Released, and
 * Blocked orders get visibly distinct treatment: a released/partially
 * released order shows its warehouse allocation(s) — which may span
 * multiple warehouses for a Priority order; a blocked order shows its
 * reason and backorder quantity and never renders a fake/placeholder
 * allocation section.
 */
export const OrderDetailsPanel = ({ order }: OrderDetailsPanelProps) => {
  const isBlocked = order.status === 'Blocked';
  const isPartiallyReleased = order.status === 'Partially Released';

  const bannerText = isBlocked
    ? 'This order is blocked and will not be fulfilled as submitted.'
    : isPartiallyReleased
      ? 'This order has been partially released; the remaining quantity is on backorder.'
      : 'This order has been released for fulfilment.';

  return (
    <div className="stack">
      <div className={`form-banner ${isBlocked ? 'form-banner--error' : 'form-banner--success'}`}>
        <StatusBadge status={order.status} /> &nbsp;
        {bannerText}
      </div>

      <div className="card">
        <div className="card__body result-panel">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Order Information
          </h2>
          <Row label="Order ID" value={order.orderId} />
          <Row label="Product ID" value={order.productId} />
          <Row label="Requested Quantity" value={order.quantity.toLocaleString()} />
          <Row label="Promised Delivery Date" value={formatDate(order.promisedDeliveryDate)} />
        </div>
      </div>

      <div className="card">
        <div className="card__body result-panel">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Customer Information
          </h2>
          <Row label="Customer ID" value={order.customerId} />
          <Row label="Customer Type" value={order.customerType} />
        </div>
      </div>

      <div className="card">
        <div className="card__body result-panel">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Fulfilment Outcome
          </h2>
          <div className="result-panel__row">
            <span className="result-panel__label">Status</span>
            <span className="result-panel__value">
              <StatusBadge status={order.status} />
            </span>
          </div>

          {isBlocked ? (
            <>
              <Row label="Reason" value={order.reason ?? '—'} />
              <Row label="Released Quantity" value={order.releasedQuantity.toLocaleString()} />
              <Row label="Backordered Quantity" value={order.backorderedQuantity.toLocaleString()} />
            </>
          ) : (
            <>
              <Row
                label={order.allocations && order.allocations.length > 1 ? 'Selected Warehouses' : 'Selected Warehouse'}
                value={formatAllocations(order)}
              />
              <Row label="Released Quantity" value={order.releasedQuantity.toLocaleString()} />
              {isPartiallyReleased && (
                <Row label="Backordered Quantity" value={order.backorderedQuantity.toLocaleString()} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
