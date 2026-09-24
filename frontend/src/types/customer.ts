export type CustomerEligibilityStatus = 'eligible' | 'credit hold' | 'unknown';

export type CustomerType = 'Standard' | 'Priority';

export const ELIGIBILITY_STATUSES: readonly CustomerEligibilityStatus[] = [
  'eligible',
  'credit hold',
  'unknown',
];

export const CUSTOMER_TYPES: readonly CustomerType[] = ['Standard', 'Priority'];

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
