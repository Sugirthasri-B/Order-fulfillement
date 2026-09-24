import { Button, StatusBadge, Table } from '../../components';
import { TableColumn } from '../../components/Table';
import { OrderDetails } from '../../types/order';
import { formatDate } from '../../utils/format';

export interface OrdersTableProps {
  orders: OrderDetails[];
  onViewDetails: (orderId: string) => void;
  onRemove: (orderId: string) => void;
}

export const OrdersTable = ({ orders, onViewDetails, onRemove }: OrdersTableProps) => {
  const columns: TableColumn<OrderDetails>[] = [
    { key: 'orderId', header: 'Order ID', render: (o) => o.orderId },
    { key: 'customerId', header: 'Customer ID', render: (o) => o.customerId },
    { key: 'customerType', header: 'Customer Type', render: (o) => o.customerType },
    { key: 'productId', header: 'Product ID', render: (o) => o.productId },
    { key: 'quantity', header: 'Quantity', align: 'right', render: (o) => o.quantity.toLocaleString() },
    {
      key: 'promisedDeliveryDate',
      header: 'Promised Delivery',
      render: (o) => formatDate(o.promisedDeliveryDate),
    },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'reason', header: 'Reason', render: (o) => o.reason ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="secondary" onClick={() => onViewDetails(o.orderId)}>
            View Details
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRemove(o.orderId)}>
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return <Table columns={columns} rows={orders} keyExtractor={(o) => o.orderId} />;
};
