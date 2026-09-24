import request from 'supertest';
import app from '../../src/app';
import {
  cleanupCustomer,
  cleanupInventory,
  cleanupOrder,
  countAllocationsForOrder,
  countBackordersForOrder,
  createTestCustomer,
  createTestInventory,
  getBackorderForOrder,
  getInventoryQuantity,
  orderExists,
  uniqueId,
} from './helpers/fixtures';
import { expectConsistentQuantities } from './helpers/assertions';

const PROMISED_DATE = '2026-12-31';
const EARLY_DISPATCH_DATE = '2026-01-01';
const LATE_DISPATCH_DATE = '2027-01-01'; // after PROMISED_DATE

describe('POST /api/orders + GET /api/orders/:orderId — Standard customers (unchanged from Stage 1)', () => {
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
        status: 'Released',
        reason: null,
        releasedQuantity: 60,
        backorderedQuantity: 0,
        allocations: [{ warehouseId: 'WH-A', allocatedQuantity: 60 }],
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

  // Exact-quantity boundary: availableQuantity equals the requested quantity.
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
        status: 'Released',
        reason: null,
        releasedQuantity: 50,
        backorderedQuantity: 0,
        allocations: [{ warehouseId: 'WH-A', allocatedQuantity: 50 }],
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
      expect(response.body.status).toBe('Released');
      expect(response.body.allocations).toEqual([{ warehouseId: 'WH-B', allocatedQuantity: 60 }]);
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

      expect(response.body.status).toBe('Released');
      expect(response.body.allocations).toEqual([{ warehouseId: 'WH-A', allocatedQuantity: 60 }]);
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

      expect(response.body.status).toBe('Released');
      expect(response.body.allocations).toEqual([{ warehouseId: 'WH-A', allocatedQuantity: 60 }]);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Test case 5: no individual warehouse has enough inventory — never combine for Standard
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
        status: 'Blocked',
        reason: 'insufficient inventory',
        releasedQuantity: 0,
        backorderedQuantity: 50,
        allocations: null,
      });
      expectConsistentQuantities(response.body, 50);
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(30); // unchanged
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(30); // unchanged
      expect(await countAllocationsForOrder(orderId)).toBe(0);
      expect(await countBackordersForOrder(orderId)).toBe(0);
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
        status: 'Blocked',
        reason: 'credit hold',
        releasedQuantity: 0,
        backorderedQuantity: 10,
        allocations: null,
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
        status: 'Blocked',
        reason: 'eligibility unknown',
        releasedQuantity: 0,
        backorderedQuantity: 10,
        allocations: null,
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
      status: 'Blocked',
      reason: 'customer not found',
      releasedQuantity: 0,
      backorderedQuantity: 10,
      allocations: null,
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
        status: 'Blocked',
        reason: 'no inventory can meet promised delivery date',
        releasedQuantity: 0,
        backorderedQuantity: 10,
        allocations: null,
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
      expect(second.body.status).toBe('Released');
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

  // GET on a blocked order includes full order details and no allocations.
  it('returns order details with no allocations for a blocked order', async () => {
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
        status: 'Blocked',
        reason: 'credit hold',
        releasedQuantity: 0,
        backorderedQuantity: 15,
        allocations: null,
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

describe('POST /api/orders — Priority customers (Stage 2 / CHANGE1)', () => {
  // The exact example from the CHANGE1 spec: 100 units, WH-A=40, WH-B=35,
  // WH-C=0 -> Released 75, Backordered 25 ("Partially Released").
  it('combines WH-A and WH-B and partially releases with a backorder for the balance (spec example)', async () => {
    const customerId = uniqueId('CUST-P1');
    const productId = uniqueId('PROD-P1');
    const orderId = uniqueId('ORD-P1');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 40,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });
    await createTestInventory({
      productId,
      warehouseId: 'WH-B',
      availableQuantity: 35,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 100,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        orderId,
        status: 'Partially Released',
        reason: null,
        releasedQuantity: 75,
        backorderedQuantity: 25,
        allocations: [
          { warehouseId: 'WH-A', allocatedQuantity: 40 },
          { warehouseId: 'WH-B', allocatedQuantity: 35 },
        ],
      });
      expectConsistentQuantities(response.body, 100);
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(0);
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(0);
      expect(await countAllocationsForOrder(orderId)).toBe(2);

      const backorder = await getBackorderForOrder(orderId);
      expect(backorder).toEqual({ backorderedQuantity: 25, status: 'Open' });
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Exactly the threshold (70%) qualifies for partial release.
  it('partially releases when exactly the threshold (70%) is available', async () => {
    const customerId = uniqueId('CUST-P2');
    const productId = uniqueId('PROD-P2');
    const orderId = uniqueId('ORD-P2');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 70,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 100,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body).toEqual({
        orderId,
        status: 'Partially Released',
        reason: null,
        releasedQuantity: 70,
        backorderedQuantity: 30,
        allocations: [{ warehouseId: 'WH-A', allocatedQuantity: 70 }],
      });
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Just below the threshold (69%) must block entirely, with no allocation
  // and no backorder.
  it('blocks with no allocation and no backorder when just below the threshold (69%)', async () => {
    const customerId = uniqueId('CUST-P3');
    const productId = uniqueId('PROD-P3');
    const orderId = uniqueId('ORD-P3');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 69,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 100,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body).toEqual({
        orderId,
        status: 'Blocked',
        reason: 'insufficient inventory',
        releasedQuantity: 0,
        backorderedQuantity: 100,
        allocations: null,
      });
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(69); // unchanged
      expect(await countAllocationsForOrder(orderId)).toBe(0);
      expect(await countBackordersForOrder(orderId)).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Combined availability covers the full order -> Released, not Partially
  // Released, and never allocates more than requested.
  it('fully releases by combining warehouses when their combined stock covers the whole order', async () => {
    const customerId = uniqueId('CUST-P4');
    const productId = uniqueId('PROD-P4');
    const orderId = uniqueId('ORD-P4');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 60,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });
    await createTestInventory({
      productId,
      warehouseId: 'WH-B',
      availableQuantity: 50,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 100,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body).toEqual({
        orderId,
        status: 'Released',
        reason: null,
        releasedQuantity: 100,
        backorderedQuantity: 0,
        allocations: [
          { warehouseId: 'WH-A', allocatedQuantity: 60 },
          { warehouseId: 'WH-B', allocatedQuantity: 40 }, // never more than requested
        ],
      });
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(10); // 50 - 40
      expect(await countBackordersForOrder(orderId)).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // A warehouse whose dispatch date is too late doesn't count toward
  // "available" stock for the combine.
  it('excludes a warehouse that cannot meet the promised delivery date from the combine', async () => {
    const customerId = uniqueId('CUST-P5');
    const productId = uniqueId('PROD-P5');
    const orderId = uniqueId('ORD-P5');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 80,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });
    await createTestInventory({
      productId,
      warehouseId: 'WH-B',
      availableQuantity: 100,
      earliestDispatchDate: LATE_DISPATCH_DATE, // excluded
    });

    try {
      const response = await request(app).post('/api/orders').send({
        orderId,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 100,
        promisedDeliveryDate: PROMISED_DATE,
      });

      // Only WH-A's 80 counts (80%) -> Partially Released, WH-B untouched.
      expect(response.body).toEqual({
        orderId,
        status: 'Partially Released',
        reason: null,
        releasedQuantity: 80,
        backorderedQuantity: 20,
        allocations: [{ warehouseId: 'WH-A', allocatedQuantity: 80 }],
      });
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(100); // untouched
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // Duplicate orderId for a Priority partial release must not duplicate
  // allocations or the backorder, and must not deduct inventory twice.
  it('returns the existing result for a duplicate Priority orderId without duplicating allocations or the backorder', async () => {
    const customerId = uniqueId('CUST-P6');
    const productId = uniqueId('PROD-P6');
    const orderId = uniqueId('ORD-P6');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 40,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });
    await createTestInventory({
      productId,
      warehouseId: 'WH-B',
      availableQuantity: 35,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const payload = {
        orderId,
        customerId,
        customerType: 'Priority',
        productId,
        quantity: 100,
        promisedDeliveryDate: PROMISED_DATE,
      };

      const first = await request(app).post('/api/orders').send(payload);
      const second = await request(app).post('/api/orders').send(payload);

      expect(first.body).toEqual(second.body);
      expect(second.body.status).toBe('Partially Released');
      expect(await countAllocationsForOrder(orderId)).toBe(2); // not 4
      expect(await countBackordersForOrder(orderId)).toBe(1); // not 2
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(0); // deducted once
      expect(await getInventoryQuantity(productId, 'WH-B')).toBe(0); // deducted once
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  // A Priority order fully satisfied by one warehouse still reports a
  // single-element allocations array (never a bare "allocation" object).
  it('reports a single-element allocations array when one warehouse alone fully covers a Priority order', async () => {
    const customerId = uniqueId('CUST-P7');
    const productId = uniqueId('PROD-P7');
    const orderId = uniqueId('ORD-P7');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
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
        customerType: 'Priority',
        productId,
        quantity: 60,
        promisedDeliveryDate: PROMISED_DATE,
      });

      expect(response.body).toEqual({
        orderId,
        status: 'Released',
        reason: null,
        releasedQuantity: 60,
        backorderedQuantity: 0,
        allocations: [{ warehouseId: 'WH-A', allocatedQuantity: 60 }],
      });
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });
});
