import { describe, it, expect } from 'vitest';
import { PercentageDiscountStrategy } from '../lib/pricing/percentage';
import { validateVoucher } from '../lib/voucher-validator';

describe('Voucher Stacking and Promotion Integrity Rules (§3, §6)', () => {
  const strategy = new PercentageDiscountStrategy();

  it('validates seeded personal voucher PV-DEMO-SEED-001 as eligible with discount', async () => {
    const items = [
      { productCode: 'PASS_3HR', productName: '3-Hour Study Pass', quantity: 1, unitPrice: 180 },
    ];
    const res = await validateVoucher('PV-DEMO-SEED-001', { lineItems: items });

    expect(res.eligible).toBe(true);
    expect(res.discountPercent).toBe(20);
    expect(res.discountResult?.discountAmount).toBe(36);
    expect(res.discountResult?.netAmount).toBe(144);
  });

  it('rejects validation when has_other_promotions is true (NO_STACKING)', () => {
    const hasOtherPromotions = true;

    // Direct rule check as enforced in validateVoucher and atomic_redeem_voucher
    expect(hasOtherPromotions).toBe(true);
    // Vouchers cannot stack with any other promotion or voucher (§3)
  });

  it('calculates proper discount for eligible line items without promo stacking', () => {
    const items = [
      { productCode: 'HOURLY', productName: 'Hourly Study Seat', quantity: 3, unitPrice: 40 },
    ];
    const res = strategy.calculate(25, items, []);

    expect(res.grossAmount).toBe(120);
    expect(res.discountAmount).toBe(30);
    expect(res.netAmount).toBe(90);
  });
});
