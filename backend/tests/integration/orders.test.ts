import request from 'supertest';
import app from '../../src/app';
import {
  cleanupCustomer,
  cleanupInventory,
  cleanupOrder,
  countAllocationsForOrder,
  createTestCustomer,
  createTestInventory,
  getInventoryQuantity,
  orderExists,
  uniqueId,
} from './helpers/fixtures';
import { expectConsistentQuantities } from './helpers/assertions';

const PROMISED_DATE = '2026-12-31';
const EARLY_DISPATCH_DATE = '2026-01-01';
const LATE_DISPATCH_DATE = '2027-01-01'; // after PROMISED_DATE

describe('POST /api/orders + GET /api/orders/:orderId', () => {
  // Test case 1: eligible customer + WH-A sufficient
  it('releases the order from WH-A when WH-A alone has enough stock', async () => {
    const customerId = uniqueId('CUST-C1');
    const productId = uniqueId('PROD-C1');
    const orderId = uniqueId('ORD-C1');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 100,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 60,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        orderId,
        status: 'released',
        reason: null,
        releasedQuantity: 60,
        backorderQuantity: 0,
        allocation: { warehouseId: 'WH-A', allocatedQuantity: 60 },
      });
      expectConsistentQuantities(response.body, 60);
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(40);
      expect(await countAllocationsForOrder(orderId)).toBe(1);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Phase 13 Scenario 5: availableQuantity exactly equals the requested
  // quantity (boundary case) with a valid dispatch date.
  it('releases the order when WH-A stock exactly equals the requested quantity', async () => {
    const customerId = uniqueId('CUST-S5');
    const productId = uniqueId('PROD-S5');
    const orderId = uniqueId('ORD-S5');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 50,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 50,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        orderId,
        status: 'released',
        reason: null,
        releasedQuantity: 50,
        backorderQuantity: 0,
        allocation: { warehouseId: 'WH-A', allocatedQuantity: 50 },
      });
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 2: WH-A insufficient, WH-B sufficient
  it('releases from WH-B when WH-A cannot cover the full quantity', async () => {
    const customerId = uniqueId('CUST-C2');
    const productId = uniqueId('PROD-C2');
    const orderId = uniqueId('ORD-C2');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 10,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });
    await createTestInventory({
      productId,
      warehouseId: 'WH-B',
      availableQuantity: 100,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 60,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('released');
      expect(response.body.allocation).toEqual({ warehouseId: 'WH-B', allocatedQuantity: 60 });
      expectConsistentQuantities(response.body, 60);
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(10); // untouched
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(40);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 3: WH-A and WH-B both sufficient -> WH-A wins
  it('selects WH-A over WH-B when both can fulfil the order', async () => {
    const customerId = uniqueId('CUST-C3');
    const productId = uniqueId('PROD-C3');
    const orderId = uniqueId('ORD-C3');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 60,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });
    await createTestInventory({
      productId,
      warehouseId: 'WH-B',
      availableQuantity: 60,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 60,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body.status).toBe('released');
      expect(response.body.allocation.warehouseId).toBe('WH-A');
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(60); // untouched
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 4: WH-A, WH-B and WH-C all sufficient -> WH-A wins
  it('selects WH-A over WH-B and WH-C when all three can fulfil the order', async () => {
    const customerId = uniqueId('CUST-C4');
    const productId = uniqueId('PROD-C4');
    const orderId = uniqueId('ORD-C4');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    for (const warehouseId of ['WH-A', 'WH-B', 'WH-C'] as const) {
      await createTestInventory({
        productId,
        warehouseId,
        availableQuantity: 60,
        earliestDispatchDate: EARLY_DISPATCH_DATE,
      });
    }

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 60,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body.status).toBe('released');
      expect(response.body.allocation.warehouseId).toBe('WH-A');
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 5: no individual warehouse has enough inventory
  it('blocks the order when no single warehouse has enough stock, without deducting anything', async () => {
    const customerId = uniqueId('CUST-C5');
    const productId = uniqueId('PROD-C5');
    const orderId = uniqueId('ORD-C5');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 30,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });
    await createTestInventory({
      productId,
      warehouseId: 'WH-B',
      availableQuantity: 30,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 50,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        orderId,
        status: 'blocked',
        reason: 'insufficient inventory',
        releasedQuantity: 0,
        backorderQuantity: 50,
        allocation: null,
      });
      expectConsistentQuantities(response.body, 50);
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(30); // unchanged
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(30); // unchanged
      expect(await countAllocationsForOrder(orderId)).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 6: customer on credit hold
  it('blocks the order with reason "credit hold" for a credit-hold customer', async () => {
    const customerId = uniqueId('CUST-C6');
    const productId = uniqueId('PROD-C6');
    const orderId = uniqueId('ORD-C6');

    await createTestCustomer({ customerId, eligibilityStatus: 'credit hold' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 100,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 10,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body).toEqual({
        orderId,
        status: 'blocked',
        reason: 'credit hold',
        releasedQuantity: 0,
        backorderQuantity: 10,
        allocation: null,
      });
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(100); // untouched
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 7: customer eligibility unknown
  it('blocks the order with reason "eligibility unknown" for an unknown-eligibility customer', async () => {
    const customerId = uniqueId('CUST-C7');
    const productId = uniqueId('PROD-C7');
    const orderId = uniqueId('ORD-C7');

    await createTestCustomer({ customerId, eligibilityStatus: 'unknown' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 100,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 10,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body).toEqual({
        orderId,
        status: 'blocked',
        reason: 'eligibility unknown',
        releasedQuantity: 0,
        backorderQuantity: 10,
        allocation: null,
      });
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 8: customer does not exist
  it('blocks the order with reason "customer not found" and persists nothing', async () => {
    const customerId = uniqueId('CUST-C8-MISSING');
    const orderId = uniqueId('ORD-C8');

    const response = await request(app).post('/api/orders').send({
      orderId,
      customerId,
      customerType: 'Standard',
      productId: uniqueId('PROD-C8'),
      quantity: 10,
      promisedDeliveryDate: PROMISED_DATE,
    });

    expect(response.body).toEqual({
      orderId,
      status: 'blocked',
      reason: 'customer not found',
      releasedQuantity: 0,
      backorderQuantity: 10,
      allocation: null,
    });
    // Nothing should have been persisted, since there is no valid customer to reference.
    expect(await orderExists(orderId)).toBe(false);
  });

  // Test case 9: sufficient quantity but dispatch date after promised delivery date
  it('blocks the order when the only sufficient warehouse cannot meet the promised delivery date', async () => {
    const customerId = uniqueId('CUST-C9');
    const productId = uniqueId('PROD-C9');
    const orderId = uniqueId('ORD-C9');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 100,
      earliestDispatchDate: LATE_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 10,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body).toEqual({
        orderId,
        status: 'blocked',
        reason: 'no inventory can meet promised delivery date',
        releasedQuantity: 0,
        backorderQuantity: 10,
        allocation: null,
      });
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(100); // untouched
      expect(await countAllocationsForOrder(orderId)).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 10: duplicate orderId is idempotent
  it('returns the existing result for a duplicate orderId without deducting inventory twice', async () => {
    const customerId = uniqueId('CUST-C10');
    const productId = uniqueId('PROD-C10');
    const orderId = uniqueId('ORD-C10');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 100,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const orderPayload = {
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 40,
        promisedDeliveryDate: PROMISED_DATE,
      };

      const first = await request(app).post('/api/orders').send(orderPayload);
      const second = await request(app).post('/api/orders').send(orderPayload);

      expect(first.body).toEqual(second.body);
      expect(second.body.status).toBe('released');
      expect(await countAllocationsForOrder(orderId)).toBe(1);
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(60); // deducted exactly once
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 11: GET an existing order
  it('returns the current fulfilment result for an existing order', async () => {
    const customerId = uniqueId('CUST-C11');
    const productId = uniqueId('PROD-C11');
    const orderId = uniqueId('ORD-C11');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 100,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const postResponse = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 25,
        promisedDeliveryDate: PROMISED_DATE,
      });

      const getResponse = await request(app).get(`/api/orders/${orderId}`);

      // GET returns everything POST does, plus the order's own request
      // details (customer/product/quantity/date) for the details view.
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toEqual({
        ...postResponse.body,
        customerId,
        customerType: 'Standard',
        productId,
        quantity: 25,
        promisedDeliveryDate: PROMISED_DATE,
      });
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 12: GET an unknown order
  it('returns 404 for an order that does not exist', async () => {
    const orderId = uniqueId('ORD-UNKNOWN');

    const response = await request(app).get(`/api/orders/${orderId}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Order not found', orderId });
  });

  // GET on a blocked order includes full order details and no allocation.
  it('returns order details with no allocation for a blocked order', async () => {
    const customerId = uniqueId('CUST-GETBLOCKED');
    const productId = uniqueId('PROD-GETBLOCKED');
    const orderId = uniqueId('ORD-GETBLOCKED');

    await createTestCustomer({ customerId, eligibilityStatus: 'credit hold', customerType: 'Priority' });

    try {
      await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 15,
        promisedDeliveryDate: PROMISED_DATE,
      });

      const getResponse = await request(app).get(`/api/orders/${orderId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toEqual({
        orderId,
        status: 'blocked',
        reason: 'credit hold',
        releasedQuantity: 0,
        backorderQuantity: 15,
        allocation: null,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 15,
        promisedDeliveryDate: PROMISED_DATE,
      });
    } finally {
      await cleanupOrder(orderId);
      await cleanupCustomer(customerId);
    }
  });
});
