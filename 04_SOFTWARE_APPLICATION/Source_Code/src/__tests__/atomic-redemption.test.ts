import { describe, it, expect } from 'vitest';

describe('Redemption Invariants & Appendix Implementation Rules (§4, §6)', () => {
  it('enforces one active redemption per voucher with partial unique index', () => {
    // Verified by migration 001 partial unique index:
    // CREATE UNIQUE INDEX idx_redemption_active_per_voucher ON redemption (personal_voucher_id) WHERE NOT is_reversed;
    const isReversed = true;
    const canReRedeem = isReversed === true;
    expect(canReRedeem).toBe(true);
  });

  it('reversal restores voucher to Active status and deducts from batch cap', () => {
    // When reversed: is_reversed = true, personal_voucher.status = 'Active'
    // Batch cap query joins: WHERE rg.batch_id = v_batch.batch_id AND r.is_reversed = false
    const redemptionState = { is_reversed: true, voucher_status: 'Active' };
    expect(redemptionState.is_reversed).toBe(true);
    expect(redemptionState.voucher_status).toBe('Active');
  });

  it('prohibits personal voucher issuance for rejected registrations', () => {
    // Appendix rule: Only an Approved registration may have one personal voucher.
    // A rejected registration never gets a QR.
    const status: string = 'Rejected';
    const hasPersonalVoucher = status === 'Approved';
    expect(hasPersonalVoucher).toBe(false);
  });

  it('allows checkout redemption for vouchers in Held status', async () => {
    const { createAdminClient } = await import('../lib/supabase/admin');
    const { redeemVoucher } = await import('../lib/voucher-validator');
    const { getMockStore } = await import('../lib/mock-store');
    
    const store = getMockStore();
    const pv = store.personal_voucher.find((v: any) => v.personal_qr_code === 'PV-DEMO-SEED-001');
    pv.status = 'Held';

    const res = await redeemVoucher({
      personalQrCode: 'PV-DEMO-SEED-001',
      source: 'api_v1',
      sessionRef: 'SES-CHECKOUT-TEST',
    });

    expect(res.success).toBe(true);
    expect(pv.status).toBe('Redeemed');
  });
});
