/**
 * Enforces the invariant that must hold for every fulfilment response,
 * released, partially released, or blocked: releasedQuantity +
 * backorderedQuantity always equals the requested quantity, and
 * releasedQuantity never exceeds it.
 */
export const expectConsistentQuantities = (
  result: { releasedQuantity: number; backorderedQuantity: number },
  requestedQuantity: number
): void => {
  expect(result.releasedQuantity + result.backorderedQuantity).toBe(requestedQuantity);
  expect(result.releasedQuantity).toBeGreaterThanOrEqual(0);
  expect(result.releasedQuantity).toBeLessThanOrEqual(requestedQuantity);
  expect(result.backorderedQuantity).toBeGreaterThanOrEqual(0);
};
