import sql from 'mssql';
import { withTransaction } from '../../src/methods/db.methods';
import {
  cleanupInventory,
  createTestInventory,
  getInventoryQuantity,
  uniqueId,
} from './helpers/fixtures';

describe('withTransaction rollback behaviour', () => {
  it('rolls back every write made inside the transaction when the work callback throws', async () => {
    const productId = uniqueId('PROD-TXN');

    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 10,
      earliestDispatchDate: '2026-01-01',
    });

    try {
      await expect(
        withTransaction(async (exec) => {
          await exec(
            `UPDATE dbo.OrdfulInventory SET AvailableQuantity = 0 WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
            {
              productId: { type: sql.NVarChar(50), value: productId },
              warehouseId: { type: sql.NVarChar(20), value: 'WH-A' },
            }
          );

          throw new Error('forced failure to trigger rollback');
        })
      ).rejects.toThrow('forced failure to trigger rollback');

      // The UPDATE must not have survived the rollback.
      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(10);
    } finally {
      await cleanupInventory(productId);
    }
  });

  it('commits every write made inside the transaction when the work callback succeeds', async () => {
    const productId = uniqueId('PROD-TXN-OK');

    await createTestInventory({
      productId,
      warehouseId: 'WH-A',
      availableQuantity: 10,
      earliestDispatchDate: '2026-01-01',
    });

    try {
      await withTransaction(async (exec) => {
        await exec(
          `UPDATE dbo.OrdfulInventory SET AvailableQuantity = 4 WHERE ProductId = @productId AND WarehouseId = @warehouseId;`,
          {
            productId: { type: sql.NVarChar(50), value: productId },
            warehouseId: { type: sql.NVarChar(20), value: 'WH-A' },
          }
        );
      });

      expect(await getInventoryQuantity(productId, 'WH-A')).toBe(4);
    } finally {
      await cleanupInventory(productId);
    }
  });
});
