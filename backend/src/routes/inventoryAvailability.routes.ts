import { Router } from 'express';
import { recordInventoryAvailability } from '../controllers/inventoryAvailability.controller';
import { validateRecordInventoryAvailability } from '../middleware/validateInventoryAvailability';

const router = Router();

router.post('/inventory-availability', validateRecordInventoryAvailability, recordInventoryAvailability);

export default router;
