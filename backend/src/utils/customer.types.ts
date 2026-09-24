export type CustomerEligibilityStatus = 'eligible' | 'credit hold' | 'unknown';

export type CustomerType = 'Standard' | 'Priority';

export const ELIGIBILITY_STATUSES: readonly CustomerEligibilityStatus[] = [
  'eligible',
  'credit hold',
  'unknown',
];

export const CUSTOMER_TYPES: readonly CustomerType[] = ['Standard', 'Priority'];

/**
 * Reference only — the fulfilment phase must block orders for a
 * non-eligible customer using exactly these reason strings.
 */
export const ELIGIBILITY_BLOCK_REASONS: Partial<Record<CustomerEligibilityStatus, string>> = {
  'credit hold': 'credit hold',
  unknown: 'eligibility unknown',
};

export interface Customer {
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  eligibilityStatus: CustomerEligibilityStatus;
  createdAt: string;
}

export interface CreateCustomerInput {
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  eligibilityStatus: CustomerEligibilityStatus;
}

export interface UpdateCustomerInput {
  customerName: string;
  customerType: CustomerType;
  eligibilityStatus: CustomerEligibilityStatus;
}
