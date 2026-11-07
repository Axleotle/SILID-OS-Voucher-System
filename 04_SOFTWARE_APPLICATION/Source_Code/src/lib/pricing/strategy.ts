/**
 * Pricing Strategy Interface (§3)
 * Model benefitType as an enum with a pricing-strategy interface
 * so other types can be added later (e.g. fixed-peso, fixed price, free hours).
 * In first-release scope: only PERCENTAGE is enabled.
 */

export interface LineItem {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number; // in PHP Pesos
}

export interface DiscountResult {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  discountPercent?: number;
  appliedToItems: string[];  // product codes discount applied to
  excludedItems: string[];   // product codes excluded from discount
}

export interface PricingStrategy {
  readonly benefitType: string;
  readonly isEnabled: boolean;

  validateBenefitValue(benefitValue: number): boolean;

  calculate(
    benefitValue: number,
    lineItems: LineItem[],
    excludedProducts: string[]
  ): DiscountResult;

  describe(benefitValue: number): string;
}
