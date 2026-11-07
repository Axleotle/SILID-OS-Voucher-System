import type { PricingStrategy, LineItem, DiscountResult } from './strategy';

/**
 * Percentage discount strategy (1% to 100%, where 100 means free).
 * First-release scope active strategy.
 */
export class PercentageDiscountStrategy implements PricingStrategy {
  readonly benefitType = 'PERCENTAGE';
  readonly isEnabled = true;

  validateBenefitValue(benefitValue: number): boolean {
    return Number.isFinite(benefitValue) && benefitValue > 0 && benefitValue <= 100;
  }

  calculate(
    benefitValue: number,
    lineItems: LineItem[],
    excludedProducts: string[]
  ): DiscountResult {
    const excludedNorm = new Set(excludedProducts.map(p => p.trim().toLowerCase()));

    let grossAmount = 0;
    let eligibleAmount = 0;
    const appliedToItems: string[] = [];
    const excludedItems: string[] = [];

    for (const item of lineItems) {
      const lineTotal = Math.round(item.unitPrice * item.quantity * 100) / 100;
      grossAmount += lineTotal;

      const isExcluded =
        excludedNorm.has(item.productName.trim().toLowerCase()) ||
        excludedNorm.has(item.productCode.trim().toLowerCase());

      if (isExcluded) {
        excludedItems.push(item.productCode);
      } else {
        eligibleAmount += lineTotal;
        appliedToItems.push(item.productCode);
      }
    }

    // Calculate discount on eligible items only
    // e.g. 20% off eligibleAmount
    const discountAmount = Math.round((eligibleAmount * (benefitValue / 100)) * 100) / 100;
    const netAmount = Math.max(0, Math.round((grossAmount - discountAmount) * 100) / 100);

    return {
      grossAmount: Math.round(grossAmount * 100) / 100,
      discountAmount,
      netAmount,
      discountPercent: benefitValue,
      appliedToItems,
      excludedItems,
    };
  }

  describe(benefitValue: number): string {
    return `${benefitValue}% discount on eligible hub sessions & passes`;
  }
}
