import sql from 'mssql';
import request from 'supertest';
import app from '../../src/app';
import { executeQuery } from '../../src/methods/db.methods';
import {
  cleanupCustomer,
  cleanupInventory,
  cleanupOrder,
  createTestCustomer,
  createTestInventory,
  getAllocationForOrderAndWarehouse,
  getBackorderForOrder,
  getFulfilmentResult,
  getInventoryQuantity,
  uniqueId,
} from './helpers/fixtures';

const PROMISED_DATE = '2026-12-31';
const EARLY_DISPATCH_DATE = '2026-01-01';

/**
 * Creates a Priority order with 80 available at WH-A against a quantity of
 * 100 — 80% clears the (default 70%) partial-release threshold, releasing
 * 80 and leaving exactly 20 on an Open backorder.
 */
const createPartiallyReleasedOrder = async (params: {
  customerId: string;
  productId: string;
  orderId: string;
}): Promise<void> => {
  await createTestCustomer({ customerId: params.customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
  await createTestInventory({
    productId: params.productId,
    warehouseId: 'WH-A',
    availableQuantity: 80,
    earliestDispatchDate: EARLY_DISPATCH_DATE,
  });

  const response = await request(app).post('/api/orders').send({
    orderId: params.orderId,
    customerId: params.customerId,
    customerType: 'Priority',
    productId: params.productId,
    quantity: 100,
    promisedDeliveryDate: PROMISED_DATE,
  });

  expect(response.status).toBe(200);
  expect(response.body.status).toBe('Partially Released');
  expect(response.body.backorderedQuantity).toBe(20);
};

describe('POST /api/inventory-availability (Stage 3 / CHANGE2)', () => {
  it('fully covers the backorder: additional allocation created, backorder closed, order released', async () => {
    const customerId = uniqueId('CUST-IA1');
    const productId = uniqueId('PROD-IA1');
    const orderId = uniqueId('ORD-IA1');

    await createPartiallyReleasedOrder({ customerId, productId, orderId });

    try {
      const backorderBefore = await getBackorderForOrder(orderId);
      expect(backorderBefore).toEqual({ backorderedQuantity: 20, status: 'Open' });

      const response = await request(app).post('/api/inventory-availability').send({
        productId,
        warehouseId: 'WH-A',
        availableQuantity: 20,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        productId,
        warehouseId: 'WH-A',
        availableQuantity: 20,
        backorderApplied: true,
        orderId,
        allocatedQuantity: 20,
        backorderedQuantity: 0,
        backorderStatus: 'Closed',
        orderStatus: 'Released',
      });

      const backorderAfter = await getBackorderForOrder(orderId);
      expect(backorderAfter).toEqual({ backorderedQuantity: 0, status: 'Closed' });

      const fulfilmentResult = await getFulfilmentResult(orderId);
      expect(fulfilmentResult).toEqual({
        status: 'Released',
        releasedQuantity: 100,
        backorderedQuantity: 0,
      });

      // Original allocation (80) topped up by 20 on the SAME warehouse row, not a duplicate row.
      expect(await getAllocationForOrderAndWarehouse(orderId, 'WH-A')).toBe(100);

      // All 20 units of new stock were consumed by the backorder — none left on hand.
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  it('never allocates more than the remaining backorder quantity — surplus stays as on-hand inventory', async () => {
    const customerId = uniqueId('CUST-IA2');
    const productId = uniqueId('PROD-IA2');
    const orderId = uniqueId('ORD-IA2');

    await createPartiallyReleasedOrder({ customerId, productId, orderId });

    try {
      const response = await request(app).post('/api/inventory-availability').send({
        productId,
        warehouseId: 'WH-A',
        availableQuantity: 200, // far more than the 20 needed
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        allocatedQuantity: 20,
        backorderedQuantity: 0,
        backorderStatus: 'Closed',
        orderStatus: 'Released',
      });

      // 200 recorded, only 20 consumed by the backorder -> 180 left on hand.
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(180);

      const fulfilmentResult = await getFulfilmentResult(orderId);
      expect(fulfilmentResult?.releasedQuantity).toBe(100);
      expect(fulfilmentResult?.backorderedQuantity).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  it('partially covers the backorder: allocation created, remaining quantity reduced, backorder stays open', async () => {
    const customerId = uniqueId('CUST-IA3');
    const productId = uniqueId('PROD-IA3');
    const orderId = uniqueId('ORD-IA3');

    await createPartiallyReleasedOrder({ customerId, productId, orderId });

    try {
      const response = await request(app).post('/api/inventory-availability').send({
        productId,
        warehouseId: 'WH-A',
        availableQuantity: 8, // less than the 20 backordered
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        allocatedQuantity: 8,
        backorderedQuantity: 12,
        backorderStatus: 'Open',
        orderStatus: 'Partially Released',
      });

      const backorderAfter = await getBackorderForOrder(orderId);
      expect(backorderAfter).toEqual({ backorderedQuantity: 12, status: 'Open' });

      const fulfilmentResult = await getFulfilmentResult(orderId);
      expect(fulfilmentResult).toEqual({
        status: 'Partially Released',
        releasedQuantity: 88,
        backorderedQuantity: 12,
      });

      expect(await getAllocationForOrderAndWarehouse(orderId, 'WH-A')).toBe(88);
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(0);
    } finally {
      await cleanupOrder(orderId);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  it('records the inventory but applies nothing when no open backorder exists for the product', async () => {
    const productId = uniqueId('PROD-IA4');

    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 10,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    try {
      const response = await request(app).post('/api/inventory-availability').send({
        productId,
        warehouseId: 'WH-A',
        availableQuantity: 25,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        productId,
        warehouseId: 'WH-A',
        availableQuantity: 25,
        backorderApplied: false,
        orderId: null,
        allocatedQuantity: 0,
        backorderedQuantity: null,
        backorderStatus: 'NoOpenBackorder',
        orderStatus: null,
      });

      // Still recorded as regular on-hand inventory.
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(35);
    } finally {
      await cleanupInventory(productId);
    }
  });

  it('applies to the oldest open backorder for the product, using orderId as the tie-breaker on equal CreatedAt', async () => {
    const customerId = uniqueId('CUST-IA5');
    const productId = uniqueId('PROD-IA5');
    const orderA = uniqueId('ORD-IA5-A');
    const orderB = uniqueId('ORD-IA5-Z');

    await createTestCustomer({ customerId, eligibilityStatus: 'eligible', customerType: 'Priority' });
    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 80,
      earliestDispatchDate: EARLY_DISPATCH_DATE,
    });

    // First order: releases 80, backorders 20.
    let response = await request(app).post('/api/orders').send({
      orderId: orderA,
      customerId,
      customerType: 'Priority',
      productId,
      quantity: 100,
      promisedDeliveryDate: PROMISED_DATE,
    });
    expect(response.body.status).toBe('Partially Released');

    // Replenish WH-A so a second order can also partially release and backorder.
    await executeQuery(
      `UPDATE dbo.OrdfulInventory SET AvailableQuantity = 80 WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
      {
        productId: { type: sql.NVarChar(50), value: productId },
        warehouseId: { type: sql.NVarChar(20), value: 'WH-A' },
      }
    );

    response = await request(app).post('/api/orders').send({
      orderId: orderB,
      customerId,
      customerType: 'Priority',
      productId,
      quantity: 100,
      promisedDeliveryDate: PROMISED_DATE,
    });
    expect(response.body.status).toBe('Partially Released');

    // Force both backorders to the exact same CreatedAt so OrderId is the
    // only remaining tie-breaker — the lower/earlier OrderId must win.
    const tiedCreatedAt = new Date('2026-01-01T00:00:00.000Z');
    await executeQuery(
      `UPDATE dbo.OrdfulBackorders SET CreatedAt = @createdAt WHERE OrderId IN (@orderA, @orderB);`,
      {
        createdAt: { type: sql.DateTime2, value: tiedCreatedAt },
        orderA: { type: sql.NVarChar(50), value: orderA },
        orderB: { type: sql.NVarChar(50), value: orderB },
      }
    );

    const winningOrderId = orderA < orderB ? orderA : orderB;
    const losingOrderId = winningOrderId === orderA ? orderB : orderA;

    try {
      // Reset WH-A so exactly the 20 needed to close one backorder is available.
      await executeQuery(
        `UPDATE dbo.OrdfulInventory SET AvailableQuantity = 0 WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
        {
          productId: { type: sql.NVarChar(50), value: productId },
          warehouseId: { type: sql.NVarChar(20), value: 'WH-A' },
        }
      );

      const availability = await request(app).post('/api/inventory-availability').send({
        productId,
        warehouseId: 'WH-A',
        availableQuantity: 20,
      });

      expect(availability.status).toBe(200);
      expect(availability.body.data.orderId).toBe(winningOrderId);

      expect(await getBackorderForOrder(winningOrderId)).toEqual({
        backorderedQuantity: 0,
        status: 'Closed',
      });
      expect(await getBackorderForOrder(losingOrderId)).toEqual({
        backorderedQuantity: 20,
        status: 'Open',
      });
    } finally {
      await cleanupOrder(orderA);
      await cleanupOrder(orderB);
      await cleanupInventory(productId);
      await cleanupCustomer(customerId);
    }
  });

  it('returns 404 when the product/warehouse inventory row does not exist yet', async () => {
    const productId = uniqueId('PROD-IA6');

    const response = await request(app).post('/api/inventory-availability').send({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 10,
    });

    expect(response.status).toBe(404);
  });

  it('rejects a non-positive availableQuantity', async () => {
    const productId = uniqueId('PROD-IA7');

    const response = await request(app).post('/api/inventory-availability').send({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 0,
    });

    expect(response.status).toBe(400);
  });
});
