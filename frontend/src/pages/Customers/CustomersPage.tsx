import { useMemo, useState } from 'react';
import { Button, EmptyState, ErrorMessage, Input, Loading, PageHeader, Select, Toast } from '../../components';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { getCustomers } from '../../services/customerService';
import { Customer, ELIGIBILITY_STATUSES } from '../../types/customer';
import { CustomerFormModal } from './CustomerFormModal';
import { CustomerTable } from './CustomerTable';

const ELIGIBILITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All eligibility statuses' },
  ...ELIGIBILITY_STATUSES.map((status) => ({ value: status, label: status })),
];

export const CustomersPage = () => {
  const { data, loading, error, refetch } = useAsync(getCustomers, []);
  const { toast, showSuccess, dismiss } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!data) return [];

    const term = searchTerm.trim().toLowerCase();

    return data.filter((customer) => {
      const matchesSearch =
        term.length === 0 ||
        customer.customerId.toLowerCase().includes(term) ||
        customer.customerName.toLowerCase().includes(term);

      const matchesEligibility =
        eligibilityFilter === 'all' || customer.eligibilityStatus === eligibilityFilter;

      return matchesSearch && matchesEligibility;
    });
  }, [data, searchTerm, eligibilityFilter]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setModalOpen(true);
  };

  const handleSaved = (message: string) => {
    showSuccess(message);
    refetch();
  };

  return (
    <div className="stack">
      <PageHeader
        title="Customers"
        description="Customer eligibility determines whether an order can proceed to fulfilment."
        actions={<Button onClick={openCreateModal}>Add Customer</Button>}
      />

      {loading && <Loading label="Loading customers…" />}
      {error && !loading && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          {data && data.length > 0 && (
            <div className="toolbar">
              <Input
                label="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by ID or name"
              />
              <Select
                label="Eligibility"
                value={eligibilityFilter}
                onChange={(e) => setEligibilityFilter(e.target.value)}
                options={ELIGIBILITY_FILTER_OPTIONS}
              />
            </div>
          )}

          {data && data.length === 0 && (
            <EmptyState
              icon="👥"
              title="No customers yet"
              description="Add your first customer to start creating orders."
              action={<Button onClick={openCreateModal}>Add Customer</Button>}
            />
          )}

          {data && data.length > 0 && filteredCustomers.length === 0 && (
            <EmptyState
              icon="🔍"
              title="No matching customers"
              description="Try a different search term or eligibility filter."
            />
          )}

          {filteredCustomers.length > 0 && (
            <CustomerTable customers={filteredCustomers} onEdit={openEditModal} />
          )}
        </>
      )}

      <CustomerFormModal
        open={modalOpen}
        editingCustomer={editingCustomer}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={dismiss} />}
    </div>
  );
};
