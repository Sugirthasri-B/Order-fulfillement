import { Router } from 'express';
import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
} from '../controllers/customer.controller';
import {
  validateCreateCustomer,
  validateCustomerIdParam,
  validateUpdateCustomer,
} from '../middleware/validateCustomer';

const router = Router();

router.post('/customers', validateCreateCustomer, createCustomer);
router.get('/customers', getAllCustomers);
router.get('/customers/:customerId', validateCustomerIdParam, getCustomerById);
router.put('/customers/:customerId', validateCustomerIdParam, validateUpdateCustomer, updateCustomer);

export default router;
