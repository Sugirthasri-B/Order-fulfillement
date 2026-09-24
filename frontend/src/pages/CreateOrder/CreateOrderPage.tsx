import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  DatePicker,
  ErrorMessage,
  FulfilmentResultPanel,
  Input,
  PageHeader,
  Select,
} from '../../components';
import { useMutation } from '../../hooks/useMutation';
import { useRecentOrders } from '../../hooks/useRecentOrders';
import { submitOrder } from '../../services/orderService';
import { isValidDateOnlyString } from '../../utils/dateOnly';
import { CUSTOMER_TYPES } from '../../types/customer';
import { CreateOrderInput, FulfilmentResult } from '../../types/order';
import { fulfilmentDetailsPath } from '../../routes/paths';

interface FormState {
  orderId: string;
  customerId: string;
  customerType: string;
  productId: string;
  quantity: string;
  promisedDeliveryDate: string;
}

const EMPTY_FORM: FormState = {
  orderId: '',
  customerId: '',
  customerType: 'Standard',
  productId: '',
  quantity: '',
  promisedDeliveryDate: '',
};

/**
 * Client-side validation only checks the request is well-formed (required
 * fields, quantity shape, date format). It never evaluates eligibility,
 * inventory, or warehouse selection — that decision belongs to the backend
 * alone, and this page only ever displays whatever it returns.
 */
const validate = (form: FormState): string | null => {
  if (form.orderId.trim().length === 0) {
    return 'Order ID is required.';
  }
  if (form.customerId.trim().length === 0) {
    return 'Customer ID is required.';
  }
  if (form.productId.trim().length === 0) {
    return 'Product ID is required.';
  }

  const quantity = Number(form.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return 'Quantity must be a whole number greater than 0.';
  }

  if (!form.promisedDeliveryDate || !isValidDateOnlyString(form.promisedDeliveryDate)) {
    return 'Promised delivery date must be a valid date.';
  }

  return null;
};

export const CreateOrderPage = () => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<FulfilmentResult | null>(null);
  const [wasAlreadySubmitted, setWasAlreadySubmitted] = useState(false);
  const { loading, error, mutate } = useMutation(submitOrder);
  const { orderIds, remember } = useRecentOrders();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setResult(null);

    const validationMessage = validate(form);
    setValidationError(validationMessage);
    if (validationMessage) {
      return;
    }

    // Purely informational — this only reflects what this browser has seen
    // before locally. The backend is still the sole authority on whether an
    // orderId is a duplicate, and returns the same completed result either way.
    const knownLocally = orderIds.includes(form.orderId.trim());

    const input: CreateOrderInput = {
      orderId: form.orderId.trim(),
      customerId: form.customerId.trim(),
      customerType: form.customerType as CreateOrderInput['customerType'],
      productId: form.productId.trim(),
      quantity: Number(form.quantity),
      promisedDeliveryDate: form.promisedDeliveryDate,
    };

    const response = await mutate(input);
    if (response) {
      remember(response.orderId);
      setResult(response);
      setWasAlreadySubmitted(knownLocally);
    }
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setValidationError(null);
    setResult(null);
    setWasAlreadySubmitted(false);
  };

  return (
    <div className="stack">
      <PageHeader
        title="Create Order"
        description="Submit an order request. The backend evaluates eligibility and inventory to decide the outcome."
      />

      <div className="card">
        <div className="card__body">
          <form className="stack" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <Input
                label="Order ID"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                placeholder="e.g. ORD1001"
                required
              />
              <Input
                label="Customer ID"
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                placeholder="e.g. CUST001"
                required
              />
            </div>
            <div className="form-grid">
              <Select
                label="Customer Type"
                value={form.customerType}
                onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                options={CUSTOMER_TYPES.map((type) => ({ value: type, label: type }))}
              />
              <Input
                label="Product ID"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                placeholder="e.g. PRD001"
                required
              />
            </div>
            <div className="form-grid">
              <Input
                label="Quantity"
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
              <DatePicker
                label="Promised Delivery Date"
                value={form.promisedDeliveryDate}
                onChange={(value) => setForm({ ...form, promisedDeliveryDate: value })}
                required
              />
            </div>

            {(validationError || error) && <ErrorMessage message={validationError ?? error ?? ''} />}

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={handleReset}>
                Reset
              </Button>
              <Button type="submit" loading={loading}>
                Submit Order
              </Button>
            </div>
          </form>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card__body stack">
            {wasAlreadySubmitted && (
              <div className="form-banner form-banner--info">
                This order ID was already submitted before — showing its existing fulfilment result.
              </div>
            )}
            <div
              className={`form-banner ${result.status === 'Blocked' ? 'form-banner--error' : 'form-banner--success'}`}
            >
              {result.status === 'Blocked'
                ? `Order ${result.orderId} was blocked.`
                : `Order ${result.orderId} was submitted successfully.`}
            </div>
            <FulfilmentResultPanel result={result} />
            <div>
              <Link to={fulfilmentDetailsPath(result.orderId)}>View full fulfilment details →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
