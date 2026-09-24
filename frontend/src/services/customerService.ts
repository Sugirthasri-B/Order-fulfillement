import { apiClient } from './apiClient';
import { ApiEnvelope } from '../types/api';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '../types/customer';

export const getCustomers = async (): Promise<Customer[]> => {
  const { data } = await apiClient.get<ApiEnvelope<Customer[]>>('/api/customers');
  return data.data;
};

export const getCustomer = async (customerId: string): Promise<Customer> => {
  const { data } = await apiClient.get<ApiEnvelope<Customer>>(`/api/customers/${customerId}`);
  return data.data;
};

export const createCustomer = async (input: CreateCustomerInput): Promise<Customer> => {
  const { data } = await apiClient.post<ApiEnvelope<Customer>>('/api/customers', input);
  return data.data;
};

export const updateCustomer = async (
  customerId: string,
  input: UpdateCustomerInput
): Promise<Customer> => {
  const { data } = await apiClient.put<ApiEnvelope<Customer>>(`/api/customers/${customerId}`, input);
  return data.data;
};
