import { Modal } from '../../components';
import { useMutation } from '../../hooks/useMutation';
import { createCustomer, updateCustomer } from '../../services/customerService';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '../../types/customer';
import { CustomerForm, CustomerFormValues } from './CustomerForm';

export interface CustomerFormModalProps {
  open: boolean;
  /** null = create a new customer; a Customer = edit that customer. */
  editingCustomer: Customer | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const toFormValues = (customer: Customer | null): CustomerFormValues =>
  customer
    ? {
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerType: customer.customerType,
        eligibilityStatus: customer.eligibilityStatus,
      }
    : { customerId: '', customerName: '', customerType: 'Standard', eligibilityStatus: 'eligible' };

export const CustomerFormModal = ({ open, editingCustomer, onClose, onSaved }: CustomerFormModalProps) => {
  const createMutation = useMutation((input: CreateCustomerInput) => createCustomer(input));
  const updateMutation = useMutation((input: UpdateCustomerInput) =>
    updateCustomer(editingCustomer?.customerId ?? '', input)
  );

  const mode = editingCustomer ? 'edit' : 'create';
  const { loading, error } = mode === 'edit' ? updateMutation : createMutation;

  const handleSubmit = async (values: CustomerFormValues) => {
    if (mode === 'edit') {
      const result = await updateMutation.mutate({
        customerName: values.customerName,
        customerType: values.customerType as UpdateCustomerInput['customerType'],
        eligibilityStatus: values.eligibilityStatus as UpdateCustomerInput['eligibilityStatus'],
      });
      if (result) {
        onSaved(`Customer ${result.customerId} updated successfully.`);
        onClose();
      }
      return;
    }

    const result = await createMutation.mutate({
      customerId: values.customerId,
      customerName: values.customerName,
      customerType: values.customerType as CreateCustomerInput['customerType'],
      eligibilityStatus: values.eligibilityStatus as CreateCustomerInput['eligibilityStatus'],
    });
    if (result) {
      onSaved(`Customer ${result.customerId} created successfully.`);
      onClose();
    }
  };

  return (
    <Modal title={mode === 'edit' ? 'Edit Customer' : 'Add Customer'} open={open} onClose={onClose}>
      <CustomerForm
        key={editingCustomer?.customerId ?? 'create'}
        mode={mode}
        initialValues={toFormValues(editingCustomer)}
        submitting={loading}
        error={error}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
};
