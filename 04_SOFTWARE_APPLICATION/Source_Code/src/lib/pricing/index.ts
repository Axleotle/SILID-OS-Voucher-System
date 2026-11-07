import type { PricingStrategy } from './strategy';
import { PercentageDiscountStrategy } from './percentage';

/**
 * Strategy Registry.
 * Other benefit types are modeled here but kept disabled (§3).
 */
class UnsupportedStrategy implements PricingStrategy {
  constructor(readonly benefitType: string, private readonly typeName: string) {}
  readonly isEnabled = false;
  validateBenefitValue(): boolean { return false; }
  calculate(): never {
    throw new Error(`Pricing strategy '${this.typeName}' is out of first-release scope and disabled.`);
  }
  describe(): string {
    return `${this.typeName} (Disabled in first release)`;
  }
}

const strategies = new Map<string, PricingStrategy>([
  ['PERCENTAGE', new PercentageDiscountStrategy()],
  ['FIXED_PESO', new UnsupportedStrategy('FIXED_PESO', 'Fixed Peso Discount')],
  ['FIXED_FINAL_PRICE', new UnsupportedStrategy('FIXED_FINAL_PRICE', 'Fixed Final Price')],
  ['FREE_HOURS', new UnsupportedStrategy('FREE_HOURS', 'Free Hours Service Recovery')],
  ['SERVICE_RECOVERY', new UnsupportedStrategy('SERVICE_RECOVERY', 'Service Recovery Voucher')],
  ['COMPLIMENTARY_PASS', new UnsupportedStrategy('COMPLIMENTARY_PASS', 'Complimentary Pass')],
  ['LEGACY_UNSUPPORTED', new UnsupportedStrategy('LEGACY_UNSUPPORTED', 'Legacy Unsupported Voucher')],
]);

export function getStrategy(benefitType: string): PricingStrategy | null {
  return strategies.get(benefitType) ?? null;
}

export function getEnabledStrategy(benefitType: string): PricingStrategy {
  const strategy = strategies.get(benefitType);
  if (!strategy) {
    throw new Error(`Unknown pricing strategy: ${benefitType}`);
  }
  if (!strategy.isEnabled) {
    throw new Error(`Strategy '${benefitType}' is disabled in this release.`);
  }
  return strategy;
}

export * from './strategy';
export * from './percentage';
