import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as orderService from '../services/order.service';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.submitOrder(req.body);
  res.status(200).json(result);
});

export const getOrderFulfilment = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const result = await orderService.getOrderDetails(orderId);

  if (!result) {
    res.status(404).json({ message: 'Order not found', orderId });
    return;
  }

  res.status(200).json(result);
});
