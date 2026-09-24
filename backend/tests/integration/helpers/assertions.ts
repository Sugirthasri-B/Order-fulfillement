/**
 * Enforces the invariant that must hold for every fulfilment response,
 * released or blocked: releasedQuantity + backorderQuantity always equals
 * the requested quantity, and releasedQuantity never exceeds it.
 */
export const expectConsistentQuantities = (
  result: { releasedQuantity: number; backorderQuantity: number },
  requestedQuantity: number
): void => {
  expect(result.releasedQuantity + result.backorderQuantity).toBe(requestedQuantity);
  expect(result.releasedQuantity).toBeGreaterThanOrEqual(0);
  expect(result.releasedQuantity).toBeLessThanOrEqual(requestedQuantity);
  expect(result.backorderQuantity).toBeGreaterThanOrEqual(0);
};
