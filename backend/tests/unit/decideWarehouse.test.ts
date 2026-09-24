import { decideWarehouse } from '../../src/services/order.service';
import { WarehouseCandidate } from '../../src/methods/order.methods';

const candidate = (overrides: Partial<WarehouseCandidate>): WarehouseCandidate => ({
  warehouseId: 'WH-A',
  availableQuantity: 100,
  earliestDispatchDate: '2026-01-01',
  ...overrides,
});

describe('decideWarehouse', () => {
  // Test case 1: eligible customer + WH-A sufficient
  it('releases from WH-A when it alone can fulfil the order', () => {
    const result = decideWarehouse(
      [candidate({ warehouseId: 'WH-A', availableQuantity: 100 })],
      50,
      '2026-01-10'
    );

    expect(result).toEqual({
      outcome: 'released',
      warehouse: candidate({ warehouseId: 'WH-A', availableQuantity: 100 }),
    });
  });

  // Phase 13 Scenario 5: availableQuantity exactly equals the requested
  // quantity (boundary case — must release, not block on an off-by-one).
  it('releases from WH-A when its available quantity exactly equals the requested quantity', () => {
    const result = decideWarehouse(
      [candidate({ warehouseId: 'WH-A', availableQuantity: 50 })],
      50,
      '2026-01-10'
    );

    expect(result).toEqual({
      outcome: 'released',
      warehouse: candidate({ warehouseId: 'WH-A', availableQuantity: 50 }),
    });
  });

  // Test case 2: WH-A insufficient, WH-B sufficient
  it('falls through to WH-B when WH-A has insufficient quantity', () => {
    const result = decideWarehouse(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 10 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 100 }),
      ],
      50,
      '2026-01-10'
    );

    expect(result.outcome).toBe('released');
    expect(result.outcome === 'released' && result.warehouse.warehouseId).toBe('WH-B');
  });

  // Test cases 3 & 4: multiple warehouses qualify -> WH-A priority wins
  it('prefers WH-A over WH-B and WH-C when all three qualify', () => {
    const result = decideWarehouse(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 50 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 50 }),
        candidate({ warehouseId: 'WH-C', availableQuantity: 50 }),
      ],
      50,
      '2026-01-10'
    );

    expect(result.outcome).toBe('released');
    expect(result.outcome === 'released' && result.warehouse.warehouseId).toBe('WH-A');
  });

  it('prefers WH-A over WH-B when both qualify', () => {
    const result = decideWarehouse(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 60 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 60 }),
      ],
      60,
      '2026-01-10'
    );

    expect(result.outcome).toBe('released');
    expect(result.outcome === 'released' && result.warehouse.warehouseId).toBe('WH-A');
  });

  // Test case 5: no single warehouse has enough quantity — never combine
  it('blocks with "insufficient inventory" instead of combining warehouses', () => {
    const result = decideWarehouse(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 30 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 30 }),
      ],
      50,
      '2026-01-10'
    );

    expect(result).toEqual({ outcome: 'blocked', reason: 'insufficient inventory' });
  });

  // Test case 9: enough quantity but dispatch date after promised delivery date
  it('blocks with a dispatch-date reason when quantity is sufficient but too late', () => {
    const result = decideWarehouse(
      [candidate({ warehouseId: 'WH-A', availableQuantity: 100, earliestDispatchDate: '2026-02-01' })],
      50,
      '2026-01-10'
    );

    expect(result).toEqual({ outcome: 'blocked', reason: 'no inventory can meet promised delivery date' });
  });

  it('skips a warehouse with enough quantity but a late dispatch date in favor of one that qualifies', () => {
    const result = decideWarehouse(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 50, earliestDispatchDate: '2026-02-01' }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 50, earliestDispatchDate: '2026-01-01' }),
      ],
      50,
      '2026-01-10'
    );

    expect(result.outcome).toBe('released');
    expect(result.outcome === 'released' && result.warehouse.warehouseId).toBe('WH-B');
  });

  it('never selects a warehouse whose quantity alone is insufficient, even if another warehouse has spare stock', () => {
    // Order quantity 50; WH-A has 30 (insufficient alone) and WH-B has 30 (insufficient alone).
    // Combined they could cover 60, but combining across warehouses is forbidden.
    const result = decideWarehouse(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 30 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 30 }),
      ],
      50,
      '2026-01-10'
    );

    expect(result.outcome).toBe('blocked');
  });
});
