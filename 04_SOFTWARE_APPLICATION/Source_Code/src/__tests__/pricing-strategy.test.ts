import { describe, it, expect } from 'vitest';
import { PercentageDiscountStrategy } from '../lib/pricing/percentage';
import { getEnabledStrategy, getStrategy } from '../lib/pricing';

describe('Pricing Strategy & Rules (§3)', () => {
  const percentageStrategy = new PercentageDiscountStrategy();

  it('validates percentage benefitValue is between 1 and 100', () => {
    expect(percentageStrategy.validateBenefitValue(20)).toBe(true);
    expect(percentageStrategy.validateBenefitValue(100)).toBe(true);
    expect(percentageStrategy.validateBenefitValue(1)).toBe(true);
    expect(percentageStrategy.validateBenefitValue(0)).toBe(false);
    expect(percentageStrategy.validateBenefitValue(-10)).toBe(false);
    expect(percentageStrategy.validateBenefitValue(101)).toBe(false);
  });

  it('calculates percentage discount correctly on eligible items', () => {
    const lineItems = [
      { productCode: 'FP_DAILY', productName: 'Daily Focus Pass', quantity: 1, unitPrice: 180 },
      { productCode: 'SNACK_COFFEE', productName: 'Iced Americano', quantity: 2, unitPrice: 70 },
    ];
    const excludedProducts: string[] = [];

    const result = percentageStrategy.calculate(20, lineItems, excludedProducts);

    expect(result.grossAmount).toBe(320); // 180 + 140
    expect(result.discountAmount).toBe(64); // 20% of 320
    expect(result.netAmount).toBe(256); // 320 - 64
    expect(result.appliedToItems).toEqual(['FP_DAILY', 'SNACK_COFFEE']);
    expect(result.excludedItems).toEqual([]);
  });

  it('excludes specified products from discount (Intensive Pass, Hub Reservations)', () => {
    const lineItems = [
      { productCode: 'FP_DAILY', productName: 'Daily Focus Pass', quantity: 1, unitPrice: 180 },
      { productCode: 'PASS_INTENSIVE', productName: 'Intensive Pass', quantity: 1, unitPrice: 420 },
      { productCode: 'RES_ROOM', productName: 'Hub Reservations', quantity: 1, unitPrice: 500 },
    ];
    const excludedProducts = ['Intensive Pass', 'Hub Reservations'];

    const result = percentageStrategy.calculate(20, lineItems, excludedProducts);

    expect(result.grossAmount).toBe(1100); // 180 + 420 + 500
    // Only 180 is eligible for 20% off
    expect(result.discountAmount).toBe(36); // 20% of 180
    expect(result.netAmount).toBe(1064); // 1100 - 36
    expect(result.appliedToItems).toEqual(['FP_DAILY']);
    expect(result.excludedItems).toEqual(['PASS_INTENSIVE', 'RES_ROOM']);
  });

  it('keeps non-percentage strategies disabled in first-release scope (§3)', () => {
    const fixedPeso = getStrategy('FIXED_PESO');
    expect(fixedPeso?.isEnabled).toBe(false);

    const fixedPrice = getStrategy('FIXED_FINAL_PRICE');
    expect(fixedPrice?.isEnabled).toBe(false);

    const freeHours = getStrategy('FREE_HOURS');
    expect(freeHours?.isEnabled).toBe(false);

    expect(() => getEnabledStrategy('FIXED_PESO')).toThrow(/disabled in this release/);
  });
});
