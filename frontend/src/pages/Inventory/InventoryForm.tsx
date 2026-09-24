import { FormEvent, useState } from 'react';
import { Button, DatePicker, ErrorMessage, Input, Select } from '../../components';
import { WAREHOUSE_IDS } from '../../types/inventory';

export interface InventoryFormValues {
  productId: string;
  warehouseId: string;
  availableQuantity: string;
  earliestDispatchDate: string;
}

export interface InventoryFormProps {
  mode: 'create' | 'edit';
  initialValues: InventoryFormValues;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: InventoryFormValues) => void;
  onCancel: () => void;
}

/**
 * The shared inventory form for both Add Inventory and Edit Inventory. In
 * edit mode productId/warehouseId are fixed (together they're Inventory's
 * real key) — only quantity and dispatch date can change.
 */
export const InventoryForm = ({
  mode,
  initialValues,
  submitting,
  error,
  onSubmit,
  onCancel,
}: InventoryFormProps) => {
  const [values, setValues] = useState<InventoryFormValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    const quantity = Number(values.availableQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setValidationError('Available quantity must be a whole number greater than 0.');
      return;
    }
    if (!values.earliestDispatchDate) {
      setValidationError('Earliest dispatch date is required.');
      return;
    }
    if (mode === 'create' && !values.warehouseId) {
      setValidationError('Warehouse is required.');
      return;
    }

    onSubmit(values);
  };

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <Input
        label="Product ID"
        value={values.productId}
        onChange={(e) => setValues({ ...values, productId: e.target.value })}
        placeholder="e.g. PROD-100"
        disabled={mode === 'edit'}
        hint={mode === 'edit' ? 'Product ID cannot be changed.' : undefined}
        required
      />
      <div className="form-grid">
        <Select
          label="Warehouse"
          value={values.warehouseId}
          onChange={(e) => setValues({ ...values, warehouseId: e.target.value })}
          placeholder="Select a warehouse"
          options={WAREHOUSE_IDS.map((id) => ({ value: id, label: id }))}
          disabled={mode === 'edit'}
          hint={mode === 'edit' ? 'Warehouse cannot be changed.' : undefined}
          required
        />
        <Input
          label="Available Quantity"
          type="number"
          min={1}
          step={1}
          value={values.availableQuantity}
          onChange={(e) => setValues({ ...values, availableQuantity: e.target.value })}
          required
        />
      </div>
      <DatePicker
        label="Earliest Dispatch Date"
        value={values.earliestDispatchDate}
        onChange={(value) => setValues({ ...values, earliestDispatchDate: value })}
        required
      />

      {(validationError || error) && <ErrorMessage message={validationError ?? error ?? ''} />}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create Inventory' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};
