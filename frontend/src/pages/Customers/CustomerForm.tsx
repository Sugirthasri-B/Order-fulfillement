import { FormEvent, useState } from 'react';
import { Button, ErrorMessage, Input, Select } from '../../components';
import { CUSTOMER_TYPES, ELIGIBILITY_STATUSES } from '../../types/customer';

export interface CustomerFormValues {
  customerId: string;
  customerName: string;
  customerType: string;
  eligibilityStatus: string;
}

export interface CustomerFormProps {
  mode: 'create' | 'edit';
  initialValues: CustomerFormValues;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
}

/**
 * The shared customer form for both Add Customer and Edit Customer. In
 * edit mode the customerId is fixed (it's the primary key) and shown
 * read-only for context.
 */
export const CustomerForm = ({
  mode,
  initialValues,
  submitting,
  error,
  onSubmit,
  onCancel,
}: CustomerFormProps) => {
  const [values, setValues] = useState<CustomerFormValues>(initialValues);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <Input
        label="Customer ID"
        value={values.customerId}
        onChange={(e) => setValues({ ...values, customerId: e.target.value })}
        placeholder="e.g. CUST-105"
        disabled={mode === 'edit'}
        hint={mode === 'edit' ? 'Customer ID cannot be changed.' : undefined}
        required
      />
      <Input
        label="Customer Name"
        value={values.customerName}
        onChange={(e) => setValues({ ...values, customerName: e.target.value })}
        placeholder="e.g. Acme Retail Ltd"
        required
      />
      <div className="form-grid">
        <Select
          label="Customer Type"
          value={values.customerType}
          onChange={(e) => setValues({ ...values, customerType: e.target.value })}
          options={CUSTOMER_TYPES.map((type) => ({ value: type, label: type }))}
        />
        <Select
          label="Eligibility Status"
          value={values.eligibilityStatus}
          onChange={(e) => setValues({ ...values, eligibilityStatus: e.target.value })}
          options={ELIGIBILITY_STATUSES.map((status) => ({ value: status, label: status }))}
        />
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create Customer' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};
