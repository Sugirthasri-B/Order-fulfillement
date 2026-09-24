import sql from 'mssql';
import { executeQuery } from './db.methods';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '../utils/customer.types';

interface CustomerRow {
  CustomerId: string;
  CustomerName: string;
  CustomerType: string;
  EligibilityStatus: string;
  CreatedAt: Date;
}

const mapRowToCustomer = (row: CustomerRow): Customer => ({
  customerId: row.CustomerId,
  customerName: row.CustomerName,
  customerType: row.CustomerType as Customer['customerType'],
  eligibilityStatus: row.EligibilityStatus as Customer['eligibilityStatus'],
  createdAt: row.CreatedAt.toISOString(),
});

export const insertCustomer = async (input: CreateCustomerInput): Promise<Customer> => {
  const rows = await executeQuery<CustomerRow>(
    `INSERT INTO dbo.OrdfulCustomers (CustomerId, CustomerName, CustomerType, EligibilityStatus)
     OUTPUT INSERTED.CustomerId, INSERTED.CustomerName, INSERTED.CustomerType, INSERTED.EligibilityStatus, INSERTED.CreatedAt
     VALUES (@customerId, @customerName, @customerType, @eligibilityStatus);`,
    {
      customerId: { type: sql.NVarChar(50), value: input.customerId },
      customerName: { type: sql.NVarChar(200), value: input.customerName },
      customerType: { type: sql.NVarChar(20), value: input.customerType },
      eligibilityStatus: { type: sql.NVarChar(20), value: input.eligibilityStatus },
    }
  );

  return mapRowToCustomer(rows[0]);
};

export const findCustomerById = async (customerId: string): Promise<Customer | null> => {
  const rows = await executeQuery<CustomerRow>(
    `SELECT CustomerId, CustomerName, CustomerType, EligibilityStatus, CreatedAt
     FROM dbo.OrdfulCustomers
     WHERE CustomerId = @customerId;`,
    {
      customerId: { type: sql.NVarChar(50), value: customerId },
    }
  );

  return rows.length > 0 ? mapRowToCustomer(rows[0]) : null;
};

export const updateCustomer = async (
  customerId: string,
  input: UpdateCustomerInput
): Promise<Customer | null> => {
  const rows = await executeQuery<CustomerRow>(
    `UPDATE dbo.OrdfulCustomers
     SET CustomerName = @customerName, CustomerType = @customerType, EligibilityStatus = @eligibilityStatus
     OUTPUT INSERTED.CustomerId, INSERTED.CustomerName, INSERTED.CustomerType, INSERTED.EligibilityStatus, INSERTED.CreatedAt
     WHERE CustomerId = @customerId;`,
    {
      customerId: { type: sql.NVarChar(50), value: customerId },
      customerName: { type: sql.NVarChar(200), value: input.customerName },
      customerType: { type: sql.NVarChar(20), value: input.customerType },
      eligibilityStatus: { type: sql.NVarChar(20), value: input.eligibilityStatus },
    }
  );

  return rows.length > 0 ? mapRowToCustomer(rows[0]) : null;
};

export const findAllCustomers = async (): Promise<Customer[]> => {
  const rows = await executeQuery<CustomerRow>(
    `SELECT CustomerId, CustomerName, CustomerType, EligibilityStatus, CreatedAt
     FROM dbo.OrdfulCustomers
     ORDER BY CreatedAt DESC;`
  );

  return rows.map(mapRowToCustomer);
};
