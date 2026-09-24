import request from 'supertest';
import app from '../../src/app';
import {
  cleanupCustomer,
  cleanupInventory,
  cleanupOrder,
  createTestCustomer,
  createTestInventory,
  getInventoryQuantity,
  uniqueId,
} from './helpers/fixtures';
import { expectConsistentQuantities } from './helpers/assertions';

const PROMISED_DATE = '2026-12-31';
const EARLY_DISPATCH_DATE = '2026-01-01';

describe('Concurrent order requests', () => {
  // Test case 13: two concurrent orders for the same product/warehouse,
  // where only one of them can actually be satisfied, must never both
  // succeed — the UPDLOCK taken while reading inventory serializes access
  // per product, so the second request sees the already-decremented
  // quantity and is blocked instead of overselling.
  it('does not oversell a warehouse when two orders race for the same limited stock', async () => {
    const customerId = uniqueId('CUST-CC');
    const productId = uniqueId('PROD-CC');
    const orderIdA = uniqueId('ORD-CC-A');
    const orderIdB = uniqueId('ORD-CC-B');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 50,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const basePayload = {
        customerId,
        customerType: 'Standard' as const,
        productId,
        quantity: 50,
        promisedDeliveryDate: PROMISED_DATE,
      };

      const [responseA, responseB] = await Promise.all([
        request(app).post('/api/orders').send({ ...basePayload, orderId: orderIdA }),
        request(app).post('/api/orders').send({ ...basePayload, orderId: orderIdB }),
      ]);

      const results = [responseA.body, responseB.body];
      const released = results.filter((r) => r.status === 'Released');
      const blocked = results.filter((r) => r.status === 'Blocked');

      expect(released).toHaveLength(1);
      expect(blocked).toHaveLength(1);
      expect(blocked[0].reason).toBe('insufficient inventory');
      expect(blocked[0].allocations).toBeNull();

      for (const result of results) {
        expectConsistentQuantities(result, 50);
      }

      // Exactly one 50-unit deduction happened; inventory cannot go negative.
      const finalQuantity = await getInventoryQuantity(productId, 'WH-A');
      expect(finalQuantity).toBe(0);
    } finally {
      await cleanupOrder(orderIdA);
      await cleanupOrder(orderIdB);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });
});
