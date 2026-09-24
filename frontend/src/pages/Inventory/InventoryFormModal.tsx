import { Modal } from '../../components';
import { useMutation } from '../../hooks/useMutation';
import { createInventory, updateInventory } from '../../services/inventoryService';
import { CreateInventoryInput, InventoryItem, UpdateInventoryInput } from '../../types/inventory';
import { InventoryForm, InventoryFormValues } from './InventoryForm';

export interface InventoryFormModalProps {
  open: boolean;
  /** null = create a new inventory line; an InventoryItem = edit that line. */
  editingItem: InventoryItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const toFormValues = (item: InventoryItem | null): InventoryFormValues =>
  item
    ? {
        productId: item.productId,
        warehouseId: item.warehouseId,
        availableQuantity: String(item.availableQuantity),
        earliestDispatchDate: item.earliestDispatchDate,
      }
    : { productId: '', warehouseId: '', availableQuantity: '', earliestDispatchDate: '' };

export const InventoryFormModal = ({ open, editingItem, onClose, onSaved }: InventoryFormModalProps) => {
  const createMutation = useMutation((input: CreateInventoryInput) => createInventory(input));
  const updateMutation = useMutation((input: UpdateInventoryInput) =>
    updateInventory(editingItem?.inventoryId ?? '', input)
  );

  const mode = editingItem ? 'edit' : 'create';
  const { loading, error } = mode === 'edit' ? updateMutation : createMutation;

  const handleSubmit = async (values: InventoryFormValues) => {
    const quantity = Number(values.availableQuantity);

    if (mode === 'edit') {
      const result = await updateMutation.mutate({
        availableQuantity: quantity,
        earliestDispatchDate: values.earliestDispatchDate,
      });
      if (result) {
        onSaved(`Inventory for ${result.productId} at ${result.warehouseId} updated successfully.`);
        onClose();
      }
      return;
    }

    const result = await createMutation.mutate({
      productId: values.productId,
      warehouseId: values.warehouseId as CreateInventoryInput['warehouseId'],
      availableQuantity: quantity,
      earliestDispatchDate: values.earliestDispatchDate,
    });
    if (result) {
      onSaved(`Inventory for ${result.productId} at ${result.warehouseId} created successfully.`);
      onClose();
    }
  };

  return (
    <Modal title={mode === 'edit' ? 'Edit Inventory' : 'Add Inventory'} open={open} onClose={onClose}>
      <InventoryForm
        key={editingItem?.inventoryId ?? 'create'}
        mode={mode}
        initialValues={toFormValues(editingItem)}
        submitting={loading}
        error={error}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
};
