import { Router } from 'express';
import customerRoutes from './customer.routes';
import healthRoutes from './health.routes';
import inventoryRoutes from './inventory.routes';
import orderRoutes from './order.routes';

const router = Router();

router.use(healthRoutes);
router.use(customerRoutes);
router.use(inventoryRoutes);
router.use(orderRoutes);

export default router;
