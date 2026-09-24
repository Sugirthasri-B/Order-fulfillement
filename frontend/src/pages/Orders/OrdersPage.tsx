import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, ErrorMessage, Input, Loading, PageHeader, Select } from '../../components';
import { useKnownOrders } from '../../hooks/useKnownOrders';
import { OrderStatus } from '../../types/order';
import { fulfilmentDetailsPath } from '../../routes/paths';
import { OrdersTable } from './OrdersTable';

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'Released', label: 'Released' },
  { value: 'Partially Released', label: 'Partially Released' },
  { value: 'Blocked', label: 'Blocked' },
];

export const OrdersPage = () => {
  const { data, loading, error, refetch, remember, forget } = useKnownOrders();
  const navigate = useNavigate();

  const [lookupId, setLookupId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');

  const customerOptions = useMemo(() => {
    const distinctCustomerIds = Array.from(new Set((data ?? []).map((o) => o.customerId))).sort();
    return [
      { value: 'all', label: 'All customers' },
      ...distinctCustomerIds.map((id) => ({ value: id, label: id })),
    ];
  }, [data]);

  const filteredOrders = useMemo(() => {
    if (!data) return [];

    const term = searchTerm.trim().toLowerCase();

    return data.filter((order) => {
      const matchesSearch =
        term.length === 0 ||
        order.orderId.toLowerCase().includes(term) ||
        order.productId.toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'all' || order.status === (statusFilter as OrderStatus);
      const matchesCustomer = customerFilter === 'all' || order.customerId === customerFilter;

      return matchesSearch && matchesStatus && matchesCustomer;
    });
  }, [data, searchTerm, statusFilter, customerFilter]);

  const handleLookup = (event: FormEvent) => {
    event.preventDefault();
    const orderId = lookupId.trim();
    if (orderId) {
      remember(orderId);
      navigate(fulfilmentDetailsPath(orderId));
    }
  };

  const handleRemove = (orderId: string) => {
    forget(orderId);
    refetch();
  };

  const isFiltered = searchTerm.length > 0 || statusFilter !== 'all' || customerFilter !== 'all';

  return (
    <div className="stack">
      <PageHeader
        title="Orders"
        description="Orders you've created or looked up on this device. Enter an exact order ID below to look up any order."
      />

      <div className="card">
        <div className="card__body">
          <form className="inline-search" onSubmit={handleLookup}>
            <Input
              label="Look up Order ID"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="e.g. ORD1001"
            />
            <Button type="submit" style={{ alignSelf: 'flex-end' }}>
              View Order
            </Button>
          </form>
        </div>
      </div>

      {loading && <Loading label="Loading orders…" />}
      {error && !loading && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          {data && data.length > 0 && (
            <div className="toolbar">
              <Input
                label="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by order ID or product ID"
              />
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={STATUS_FILTER_OPTIONS}
              />
              <Select
                label="Customer"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                options={customerOptions}
              />
            </div>
          )}

          {data && data.length === 0 && (
            <EmptyState
              icon="🧾"
              title="No orders yet"
              description="Orders you create or look up will appear here for quick access on this device."
            />
          )}

          {data && data.length > 0 && filteredOrders.length === 0 && (
            <EmptyState
              icon="🔍"
              title="No matching orders"
              description="Try a different search term, status, or customer filter."
            />
          )}

          {filteredOrders.length > 0 && (
            <OrdersTable
              orders={filteredOrders}
              onViewDetails={(orderId) => navigate(fulfilmentDetailsPath(orderId))}
              onRemove={handleRemove}
            />
          )}
        </>
      )}
    </div>
  );
};
