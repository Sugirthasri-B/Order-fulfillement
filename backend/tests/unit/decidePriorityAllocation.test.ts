import { decidePriorityAllocation } from '../../src/services/order.service';
import { WarehouseCandidate } from '../../src/methods/order.methods';

const candidate = (overrides: Partial<WarehouseCandidate>): WarehouseCandidate => ({
  warehouseId: 'WH-A',
  availableQuantity: 100,
  earliestDispatchDate: '2026-01-01',
  ...overrides,
});

const THRESHOLD = 70;

describe('decidePriorityAllocation', () => {
  // The exact example from the CHANGE1 spec.
  it('combines WH-A and WH-B in order and partially releases for the spec example (40+35 of 100)', () => {
    const result = decidePriorityAllocation(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 40 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 35 }),
      ],
      100,
      '2026-01-10',
      THRESHOLD
    );

    expect(result).toEqual({
      outcome: 'partially-released',
      releasedQuantity: 75,
      backorderedQuantity: 25,
      allocations: [
        { warehouseId: 'WH-A', allocatedQuantity: 40 },
        { warehouseId: 'WH-B', allocatedQuantity: 35 },
      ],
    });
  });

  it('releases in full when combined stock covers the whole order, never allocating more than requested', () => {
    const result = decidePriorityAllocation(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 60 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 50 }),
      ],
      100,
      '2026-01-10',
      THRESHOLD
    );

    expect(result).toEqual({
      outcome: 'released',
      releasedQuantity: 100,
      backorderedQuantity: 0,
      allocations: [
        { warehouseId: 'WH-A', allocatedQuantity: 60 },
        { warehouseId: 'WH-B', allocatedQuantity: 40 },
      ],
    });
  });

  it('treats exactly the threshold (70%) as qualifying for partial release', () => {
    const result = decidePriorityAllocation(
      [candidate({ warehouseId: 'WH-A', availableQuantity: 70 })],
      100,
      '2026-01-10',
      THRESHOLD
    );

    expect(result.outcome).toBe('partially-released');
    expect(result.releasedQuantity).toBe(70);
    expect(result.backorderedQuantity).toBe(30);
  });

  it('blocks with no allocation when just below the threshold (69%)', () => {
    const result = decidePriorityAllocation(
      [candidate({ warehouseId: 'WH-A', availableQuantity: 69 })],
      100,
      '2026-01-10',
      THRESHOLD
    );

    expect(result).toEqual({
      outcome: 'blocked',
      releasedQuantity: 0,
      backorderedQuantity: 100,
      allocations: [],
      reason: 'insufficient inventory',
    });
  });

  it('never selects a lower-priority warehouse before a higher-priority one is exhausted', () => {
    const result = decidePriorityAllocation(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 20 }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 20 }),
        candidate({ warehouseId: 'WH-C', availableQuantity: 100 }),
      ],
      50,
      '2026-01-10',
      THRESHOLD
    );

    // WH-A fully consumed (20), WH-B fully consumed (20), WH-C tops up the
    // remaining 10 — never skips ahead to WH-C while WH-A/WH-B have stock.
    expect(result.allocations).toEqual([
      { warehouseId: 'WH-A', allocatedQuantity: 20 },
      { warehouseId: 'WH-B', allocatedQuantity: 20 },
      { warehouseId: 'WH-C', allocatedQuantity: 10 },
    ]);
    expect(result.outcome).toBe('released');
  });

  it('excludes a warehouse whose dispatch date is after the promised delivery date', () => {
    const result = decidePriorityAllocation(
      [
        candidate({ warehouseId: 'WH-A', availableQuantity: 80, earliestDispatchDate: '2026-01-01' }),
        candidate({ warehouseId: 'WH-B', availableQuantity: 100, earliestDispatchDate: '2026-06-01' }), // too late
      ],
      100,
      '2026-01-10',
      THRESHOLD
    );

    // Only WH-A's 80 counts (80%) -> partially released, WH-B never touched.
    expect(result).toEqual({
      outcome: 'partially-released',
      releasedQuantity: 80,
      backorderedQuantity: 20,
      allocations: [{ warehouseId: 'WH-A', allocatedQuantity: 80 }],
    });
  });

  it('blocks with zero available stock', () => {
    const result = decidePriorityAllocation([], 50, '2026-01-10', THRESHOLD);

    expect(result).toEqual({
      outcome: 'blocked',
      releasedQuantity: 0,
      backorderedQuantity: 50,
      allocations: [],
      reason: 'insufficient inventory',
    });
  });

  it('honors a configured threshold other than the 70% default', () => {
    // With a 50% threshold, 40% available is still not enough.
    const blocked = decidePriorityAllocation(
      [candidate({ warehouseId: 'WH-A', availableQuantity: 40 })],
      100,
      '2026-01-10',
      50
    );
    expect(blocked.outcome).toBe('blocked');

    // With a 30% threshold, 40% available now qualifies.
    const partial = decidePriorityAllocation(
      [candidate({ warehouseId: 'WH-A', availableQuantity: 40 })],
      100,
      '2026-01-10',
      30
    );
    expect(partial.outcome).toBe('partially-released');
    expect(partial.releasedQuantity).toBe(40);
  });
});
