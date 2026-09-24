import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as customerService from '../services/customer.service';

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.createCustomer(req.body);
  res.status(201).json({ status: 'ok', data: customer });
});

export const getAllCustomers = asyncHandler(async (_req: Request, res: Response) => {
  const customers = await customerService.getAllCustomers();
  res.status(200).json({ status: 'ok', data: customers });
});

export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const customer = await customerService.getCustomerById(customerId);
  res.status(200).json({ status: 'ok', data: customer });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const customer = await customerService.updateCustomer(customerId, req.body);
  res.status(200).json({ status: 'ok', data: customer });
});
