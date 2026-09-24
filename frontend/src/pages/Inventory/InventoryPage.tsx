import axios from 'axios';
import { FormEvent, useState } from 'react';
import { Button, EmptyState, ErrorMessage, Input, Loading, PageHeader, Select, Toast } from '../../components';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import {
  getAllInventory,
  getInventoryByProductId,
  getInventoryByWarehouseId,
} from '../../services/inventoryService';
import { InventoryItem, WAREHOUSE_IDS } from '../../types/inventory';
import { InventoryFormModal } from './InventoryFormModal';
import { InventoryTable } from './InventoryTable';

const WAREHOUSE_FILTER_OPTIONS = [
  { value: 'all', label: 'All warehouses' },
  ...WAREHOUSE_IDS.map((id) => ({ value: id, label: id })),
];

/** A 404 from a lookup means "no matches" for this page, not a real error. */
const asEmptyOn404 = async (request: Promise<InventoryItem[]>): Promise<InventoryItem[]> => {
  try {
    return await request;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

const fetchInventoryList = async (
  appliedSearch: string,
  warehouseFilter: string
): Promise<InventoryItem[]> => {
  if (appliedSearch) {
    return asEmptyOn404(
      getInventoryByProductId(appliedSearch, warehouseFilter === 'all' ? undefined : warehouseFilter).then(
        (result) => (Array.isArray(result) ? result : [result])
      )
    );
  }

  if (warehouseFilter !== 'all') {
    return asEmptyOn404(getInventoryByWarehouseId(warehouseFilter));
  }

  // GET /api/inventory never 404s by design (it's a collection endpoint) —
  // any 404 here means something is actually wrong, so let it surface.
  return getAllInventory();
};

export const InventoryPage = () => {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data, loading, error, refetch } = useAsync(
    () => fetchInventoryList(appliedSearch, warehouseFilter),
    [appliedSearch, warehouseFilter]
  );
  const { toast, showSuccess, dismiss } = useToast();

  const isFiltered = appliedSearch.length > 0 || warehouseFilter !== 'all';

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setWarehouseFilter('all');
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSaved = (message: string) => {
    showSuccess(message);
    refetch();
  };

  return (
    <div className="stack">
      <PageHeader
        title="Inventory"
        description="Stock levels and dispatch readiness by product and warehouse."
        actions={<Button onClick={openCreateModal}>Add Inventory</Button>}
      />

      <div className="card">
        <div className="card__body">
          <form className="toolbar" onSubmit={handleSearchSubmit}>
            <Input
              label="Search Product"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Exact product ID, e.g. PROD-100"
            />
            <Select
              label="Warehouse"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              options={WAREHOUSE_FILTER_OPTIONS}
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {isFiltered && (
              <Button type="button" variant="ghost" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </form>
        </div>
      </div>

      {loading && <Loading label="Loading inventory…" />}
      {error && !loading && <ErrorMessage message={error} />}

      {!loading && !error && data && data.length === 0 && !isFiltered && (
        <EmptyState
          icon="📦"
          title="No inventory yet"
          description="Add stock for a product and warehouse to make it available for orders."
          action={<Button onClick={openCreateModal}>Add Inventory</Button>}
        />
      )}

      {!loading && !error && data && data.length === 0 && isFiltered && (
        <EmptyState
          icon="🔍"
          title="No matching inventory"
          description="Try a different product ID or warehouse filter."
          action={
            <Button variant="secondary" onClick={handleClearFilters}>
              Clear filters
            </Button>
          }
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <InventoryTable items={data} onEdit={openEditModal} />
      )}

      <InventoryFormModal
        open={modalOpen}
        editingItem={editingItem}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={dismiss} />}
    </div>
  );
};
