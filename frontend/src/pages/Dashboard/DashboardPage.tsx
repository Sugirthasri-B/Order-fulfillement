import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Button, DonutChart, ErrorMessage, Loading, PageHeader } from '../../components';
import { useAsync } from '../../hooks/useAsync';
import { useKnownOrders } from '../../hooks/useKnownOrders';
import { getCustomers } from '../../services/customerService';
import { getAllInventory } from '../../services/inventoryService';
import { WAREHOUSE_IDS } from '../../types/inventory';
import { ROUTES, fulfilmentDetailsPath } from '../../routes/paths';

export const DashboardPage = () => {
  const customers = useAsync(getCustomers, []);
  const inventory = useAsync(getAllInventory, []);
  const orders = useKnownOrders();

  const loading = customers.loading || inventory.loading || orders.loading;
  const error = customers.error ?? inventory.error ?? orders.error;

  const eligibleCount = customers.data?.filter((c) => c.eligibilityStatus === 'eligible').length ?? 0;
  const holdCount = customers.data?.filter((c) => c.eligibilityStatus === 'credit hold').length ?? 0;
  const unknownCount = customers.data?.filter((c) => c.eligibilityStatus === 'unknown').length ?? 0;
  const totalUnits = inventory.data?.reduce((sum, item) => sum + item.availableQuantity, 0) ?? 0;

  const warehouseProductCounts = useMemo(
    () =>
      WAREHOUSE_IDS.map((warehouseId) => ({
        label: warehouseId,
        value: inventory.data?.filter((item) => item.warehouseId === warehouseId).length ?? 0,
      })),
    [inventory.data]
  );

  const orderStatusCounts = useMemo(() => {
    const released = orders.data?.filter((o) => o.status === 'released').length ?? 0;
    const partiallyReleased = orders.data?.filter((o) => o.status === 'partially released').length ?? 0;
    const blocked = orders.data?.filter((o) => o.status === 'blocked').length ?? 0;
    return [
      { label: 'released', value: released, color: 'var(--status-good)' },
      { label: 'partially released', value: partiallyReleased, color: 'var(--status-warning)' },
      { label: 'blocked', value: blocked, color: 'var(--status-critical)' },
    ];
  }, [orders.data]);

  return (
    <div className="stack">
      <PageHeader
        title="Dashboard"
        description="A quick overview of customers, inventory, and recent order activity."
        actions={
          <Link to={ROUTES.createOrder}>
            <Button>New Order</Button>
          </Link>
        }
      />

      {loading && <Loading label="Loading overview…" />}
      {error && !loading && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card__row">
                <span className="stat-card__label">Customers</span>
                <span className="stat-card__icon" aria-hidden="true">👥</span>
              </div>
              <span className="stat-card__value">{customers.data?.length ?? 0}</span>
            </div>
            <div className="stat-card">
              <div className="stat-card__row">
                <span className="stat-card__label">Known Orders</span>
                <span className="stat-card__icon" aria-hidden="true">🧾</span>
              </div>
              <span className="stat-card__value">{orders.data?.length ?? 0}</span>
            </div>
            <div className="stat-card">
              <div className="stat-card__row">
                <span className="stat-card__label">Inventory Lines</span>
                <span className="stat-card__icon" aria-hidden="true">📦</span>
              </div>
              <span className="stat-card__value">{inventory.data?.length ?? 0}</span>
            </div>
            <div className="stat-card">
              <div className="stat-card__row">
                <span className="stat-card__label">Units on Hand</span>
                <span className="stat-card__icon" aria-hidden="true">📊</span>
              </div>
              <span className="stat-card__value">{totalUnits.toLocaleString()}</span>
            </div>
          </div>

          <div className="chart-grid">
            <div className="card">
              <div className="card__body">
                <h2 className="chart-card__title">Customers by Eligibility</h2>
                <DonutChart
                  centerLabel={String(customers.data?.length ?? 0)}
                  data={[
                    { label: 'eligible', value: eligibleCount, color: 'var(--status-good)' },
                    { label: 'credit hold', value: holdCount, color: 'var(--status-critical)' },
                    { label: 'unknown', value: unknownCount, color: 'var(--status-neutral)' },
                  ]}
                />
              </div>
            </div>

            <div className="card">
              <div className="card__body">
                <h2 className="chart-card__title">Products by Warehouse</h2>
                <BarChart data={warehouseProductCounts} />
                <p className="chart-card__caption">Number of distinct products stocked at each warehouse.</p>
              </div>
            </div>

            <div className="card">
              <div className="card__body">
                <h2 className="chart-card__title">Known Orders by Status</h2>
                <DonutChart centerLabel={String(orders.data?.length ?? 0)} data={orderStatusCounts} />
                <p className="chart-card__caption">
                  Only orders created or looked up on this device — the backend has no
                  "list all orders" endpoint.
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__body stack">
              <h2 className="section-title">Recently viewed orders</h2>
              {orders.orderIds.length === 0 ? (
                <p className="text-muted">
                  Orders you create or look up will appear here for quick access.
                </p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orders.orderIds.slice(0, 5).map((orderId) => (
                    <li key={orderId}>
                      <Link to={fulfilmentDetailsPath(orderId)}>{orderId}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
