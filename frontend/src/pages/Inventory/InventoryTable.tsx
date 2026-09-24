import { Button, Table } from '../../components';
import { TableColumn } from '../../components/Table';
import { InventoryItem } from '../../types/inventory';
import { formatDate, formatDateTime } from '../../utils/format';

export interface InventoryTableProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
}

export const InventoryTable = ({ items, onEdit }: InventoryTableProps) => {
  const columns: TableColumn<InventoryItem>[] = [
    { key: 'productId', header: 'Product ID', render: (i) => i.productId },
    { key: 'warehouseId', header: 'Warehouse', render: (i) => i.warehouseId },
    {
      key: 'availableQuantity',
      header: 'Available Qty',
      align: 'right',
      render: (i) => i.availableQuantity.toLocaleString(),
    },
    { key: 'earliestDispatchDate', header: 'Earliest Dispatch', render: (i) => formatDate(i.earliestDispatchDate) },
    { key: 'updatedAt', header: 'Updated', render: (i) => formatDateTime(i.updatedAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <Button size="sm" variant="secondary" onClick={() => onEdit(i)}>
          Edit
        </Button>
      ),
    },
  ];

  return <Table columns={columns} rows={items} keyExtractor={(i) => i.inventoryId} />;
};
