import { decideBackorderApplication } from '../../src/services/inventoryAvailability.service';

describe('decideBackorderApplication (Stage 3 / CHANGE2)', () => {
  it('closes the backorder when available quantity fully covers the remaining balance', () => {
    const result = decideBackorderApplication(25, 25);

    expect(result).toEqual({
      allocatedQuantity: 25,
      remainingBackorderedQuantity: 0,
      backorderStatus: 'Closed',
    });
  });

  it('closes the backorder and never allocates more than the remaining balance when surplus is available', () => {
    const result = decideBackorderApplication(25, 100);

    expect(result).toEqual({
      allocatedQuantity: 25,
      remainingBackorderedQuantity: 0,
      backorderStatus: 'Closed',
    });
  });

  it('keeps the backorder open and reduces the remaining balance on partial coverage', () => {
    const result = decideBackorderApplication(25, 10);

    expect(result).toEqual({
      allocatedQuantity: 10,
      remainingBackorderedQuantity: 15,
      backorderStatus: 'Open',
    });
  });

  it('allocates nothing and stays open when no quantity is available', () => {
    const result = decideBackorderApplication(25, 0);

    expect(result).toEqual({
      allocatedQuantity: 0,
      remainingBackorderedQuantity: 25,
      backorderStatus: 'Open',
    });
  });
});
