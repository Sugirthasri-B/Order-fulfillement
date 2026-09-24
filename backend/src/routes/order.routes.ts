import { Router } from 'express';
import { createOrder, getOrderFulfilment } from '../controllers/order.controller';
import { validateCreateOrder, validateOrderIdParam } from '../middleware/validateOrder';

const router = Router();

router.post('/orders', validateCreateOrder, createOrder);
router.get('/orders/:orderId', validateOrderIdParam, getOrderFulfilment);

export default router;
