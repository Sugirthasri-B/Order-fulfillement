import { AppError } from '../utils/AppError';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '../utils/customer.types';
import {
  findAllCustomers,
  findCustomerById,
  insertCustomer,
  updateCustomer as updateCustomerRow,
} from '../methods/customer.methods';

export const createCustomer = async (input: CreateCustomerInput): Promise<Customer> => {
  const existingCustomer = await findCustomerById(input.customerId);

  if (existingCustomer) {
    throw new AppError(`Customer '${input.customerId}' already exists`, 409);
  }

  return insertCustomer(input);
};

export const getCustomerById = async (customerId: string): Promise<Customer> => {
  const customer = await findCustomerById(customerId);

  if (!customer) {
    throw new AppError(`Customer '${customerId}' not found`, 404);
  }

  return customer;
};

export const getAllCustomers = async (): Promise<Customer[]> => {
  return findAllCustomers();
};

export const updateCustomer = async (
  customerId: string,
  input: UpdateCustomerInput
): Promise<Customer> => {
  const updated = await updateCustomerRow(customerId, input);

  if (!updated) {
    throw new AppError(`Customer '${customerId}' not found`, 404);
  }

  return updated;
};
