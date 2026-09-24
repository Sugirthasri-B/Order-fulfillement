import { Router } from 'express';
import {
  createInventory,
  getAllInventory,
  getInventoryByProductId,
  getInventoryByWarehouseId,
  updateInventory,
} from '../controllers/inventory.controller';
import {
  validateCreateInventory,
  validateInventoryIdParam,
  validateProductIdParam,
  validateUpdateInventory,
  validateWarehouseIdParam,
  validateWarehouseIdQuery,
} from '../middleware/validateInventory';

const router = Router();

router.post('/inventory', validateCreateInventory, createInventory);
router.get('/inventory', getAllInventory);
router.get(
  '/inventory/product/:productId',
  validateProductIdParam,
  validateWarehouseIdQuery,
  getInventoryByProductId
);
router.get('/inventory/warehouse/:warehouseId', validateWarehouseIdParam, getInventoryByWarehouseId);
router.put('/inventory/:inventoryId', validateInventoryIdParam, validateUpdateInventory, updateInventory);

export default router;
