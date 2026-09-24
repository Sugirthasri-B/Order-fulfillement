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

/**
 * The full Fulfilment Details view. Released and blocked orders get
 * visibly distinct treatment: a released order shows its warehouse
 * allocation; a blocked order shows its reason and backorder quantity and
 * never renders a fake/placeholder allocation section.
 */
export const OrderDetailsPanel = ({ order }: OrderDetailsPanelProps) => {
  const isReleased = order.status !== 'blocked';

  return (
    <div className="stack">
      <div className={`form-banner ${isReleased ? 'form-banner--success' : 'form-banner--error'}`}>
        <StatusBadge status={order.status} /> &nbsp;
        {isReleased
          ? 'This order has been released for fulfilment.'
          : 'This order is blocked and will not be fulfilled as submitted.'}
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

          {isReleased ? (
            <>
              <Row
                label="Selected Warehouse"
                value={order.allocation ? order.allocation.warehouseId : '—'}
              />
              <Row label="Allocated Quantity" value={order.releasedQuantity.toLocaleString()} />
            </>
          ) : (
            <>
              <Row label="Reason" value={order.reason ?? '—'} />
              <Row label="Released Quantity" value={order.releasedQuantity.toLocaleString()} />
              <Row label="Backorder Quantity" value={order.backorderQuantity.toLocaleString()} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
