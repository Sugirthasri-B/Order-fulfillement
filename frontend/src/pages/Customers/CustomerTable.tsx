import { Button, StatusBadge, Table } from '../../components';
import { TableColumn } from '../../components/Table';
import { Customer } from '../../types/customer';
import { formatDateTime } from '../../utils/format';

export interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
}

export const CustomerTable = ({ customers, onEdit }: CustomerTableProps) => {
  const columns: TableColumn<Customer>[] = [
    { key: 'customerId', header: 'Customer ID', render: (c) => c.customerId },
    { key: 'customerName', header: 'Name', render: (c) => c.customerName },
    { key: 'customerType', header: 'Type', render: (c) => c.customerType },
    {
      key: 'eligibilityStatus',
      header: 'Eligibility',
      render: (c) => <StatusBadge status={c.eligibilityStatus} />,
    },
    { key: 'createdAt', header: 'Created', render: (c) => formatDateTime(c.createdAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <Button size="sm" variant="secondary" onClick={() => onEdit(c)}>
          Edit
        </Button>
      ),
    },
  ];

  return <Table columns={columns} rows={customers} keyExtractor={(c) => c.customerId} />;
};
