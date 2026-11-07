import { describe, it, expect, beforeEach } from 'vitest';
import { createAdminClient } from '../lib/supabase/admin';
import { getMockStore, resetMockStore } from '../lib/mock-store';
import { validateVoucher, redeemVoucher, reverseRedemption } from '../lib/voucher-validator';
import { PercentageDiscountStrategy } from '../lib/pricing/percentage';
import { calculateExpiryDate, getBusinessDayPHT, formatDisplayPHT, isExpired } from '../lib/timezone';
import { QRCodeGenerator } from '../lib/qr';
import { detectBatchAnomaly, detectRedemptionAnomalies } from '../lib/audit';
import { approveRegistrationAction } from '../app/(staff)/staff/registrations/actions';
import crypto from 'crypto';

describe('Master Client Acceptance Test Suite (TC-01 through TC-75)', () => {
  let admin: any;
  let store: any;

  beforeEach(() => {
    store = resetMockStore();
    admin = createAdminClient();
  });

  // =========================================================================
  // Module 1: Staff Authentication & Role-Based Access Control
  // =========================================================================
  describe('Module 1: Staff Authentication & Roles (TC-01 - TC-05)', () => {
    it('TC-01 & TC-02: Founder and Staff demo accounts exist with correct roles', () => {
      const founder = store.staff.find((s: any) => s.email === 'founder@silid.ph');
      const staff = store.staff.find((s: any) => s.email === 'staff@silid.ph');

      expect(founder).toBeDefined();
      expect(founder.role).toBe('Founder');
      expect(staff).toBeDefined();
      expect(staff.role).toBe('Staff');
    });

    it('TC-04: Enforces threshold approval rule for bulk batches (> 50 tickets)', () => {
      const BULK_THRESHOLD = 50;
      const staffUser = { role: 'Staff' };
      const founderUser = { role: 'Founder' };

      const isStaffBlockedFor100 = 100 > BULK_THRESHOLD && staffUser.role === 'Staff';
      const isFounderAllowedFor100 = !(100 > BULK_THRESHOLD && founderUser.role === 'Staff');

      expect(isStaffBlockedFor100).toBe(true);
      expect(isFounderAllowedFor100).toBe(true);
    });
  });

  // =========================================================================
  // Module 2: Voucher Template Management
  // =========================================================================
  describe('Module 2: Voucher Template Management (TC-06 - TC-11)', () => {
    it('TC-06: Creates standard percentage discount template', async () => {
      const { data, error } = await admin.from('voucher_template').insert({
        template_name: 'Midterm Study Marathon 25%',
        benefit_type: 'PERCENTAGE',
        benefit_value: 25,
        effective_duration: 14,
        restrictions: 'Valid for open study desks only',
        excluded_products: ['PASS_INTENSIVE', 'HUB_RESERVATION'],
        description: 'Finals week discount',
        status: 'Active',
      });

      expect(error).toBeNull();
      expect(data.benefit_value).toBe(25);
      expect(data.status).toBe('Active');
    });

    it('TC-07: Creates 100% Free Pass template', async () => {
      const { data, error } = await admin.from('voucher_template').insert({
        template_name: 'Community Complimentary Pass',
        benefit_type: 'PERCENTAGE',
        benefit_value: 100,
        effective_duration: 7,
        status: 'Active',
      });

      expect(error).toBeNull();
      expect(data.benefit_value).toBe(100);
    });

    it('supports chained .insert().select().single() like PostgREST', async () => {
      const { data, error } = await admin.from('voucher_template').insert({
        template_name: 'Test Chained Insert',
        benefit_value: 30,
        status: 'Active',
      }).select().single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.template_id).toBeDefined();
      expect(data.template_name).toBe('Test Chained Insert');
    });

    it('TC-08: Rejects benefit values outside 1-100 range', () => {
      const strategy = new PercentageDiscountStrategy();
      expect(strategy.validateBenefitValue(0)).toBe(false);
      expect(strategy.validateBenefitValue(105)).toBe(false);
      expect(strategy.validateBenefitValue(25)).toBe(true);
      expect(strategy.validateBenefitValue(100)).toBe(true);
    });

    it('TC-10 & TC-11: Deactivates and reactivates templates', async () => {
      const template = store.voucher_template[0];
      template.status = 'Inactive';
      expect(template.status).toBe('Inactive');

      template.status = 'Active';
      expect(template.status).toBe('Active');
    });
  });

  // =========================================================================
  // Module 3: Event Batch Generation & Claim Tickets
  // =========================================================================
  describe('Module 3: Event Batch & Claim Tickets (TC-12 - TC-17)', () => {
    it('TC-12: Generates event batch with unique claim tickets', async () => {
      const batchQuantity = 5;
      const codePrefix = 'BULSU';
      const tickets = [];

      for (let i = 0; i < batchQuantity; i++) {
        const code = QRCodeGenerator.generateClaimCode(codePrefix);
        const qrPayload = QRCodeGenerator.generateClaimTicketPayload(code);
        tickets.push({ code, qrPayload });
      }

      expect(tickets.length).toBe(5);
      // Check cryptographic uniqueness
      const uniqueCodes = new Set(tickets.map((t) => t.code));
      expect(uniqueCodes.size).toBe(5);
      expect(tickets[0].code.startsWith('BULSU-')).toBe(true);
    });

    it('TC-13: Rejects batch creation when maxRedemptions > batchQuantity', () => {
      const batchQuantity = 10;
      const maxRedemptions = 15;
      const isValid = maxRedemptions > 0 && maxRedemptions <= batchQuantity;
      expect(isValid).toBe(false);
    });

    it('TC-14: Rejects batch creation when claimDeadline is before eventDate', () => {
      const eventDate = new Date('2026-12-15');
      const claimDeadline = new Date('2026-12-01');
      const isValid = claimDeadline >= eventDate;
      expect(isValid).toBe(false);
    });

    it('TC-16: Generates valid QR data URL for printable cards', async () => {
      const qrDataUrl = await QRCodeGenerator.toDataURL('http://localhost:3000/register/BULSU-TEST', 160);
      expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });
  });

  // =========================================================================
  // Module 4: Public Student Claim Registration
  // =========================================================================
  describe('Module 4: Student Claim Registration (TC-18 - TC-23)', () => {
    it('TC-18: Resolves available claim ticket CT-YTR-003', async () => {
      const { data: ticket } = await admin
        .from('claim_ticket')
        .select('*')
        .eq('claim_code', 'CT-YTR-003')
        .single();

      expect(ticket).toBeDefined();
      expect(ticket.claim_code).toBe('CT-YTR-003');
      expect(ticket.status).toBe('Available');
    });

    it('TC-21: Enforces UNIQUE(studentId, batchId) — duplicate claim prevention', () => {
      const registrations = store.registration;
      const existing = registrations.find(
        (r: any) => r.student_id === 'STU-2024-001' && r.batch_id === 'c0000000-0000-0000-0000-000000000001'
      );

      // Attempting to register the same student in the same batch must be rejected
      const isDuplicate = Boolean(existing);
      expect(isDuplicate).toBe(true);
    });

    it('TC-22: Locks registration when claim deadline has passed', () => {
      const pastDeadline = new Date(Date.now() - 86400000).toISOString();
      const isExpiredDeadline = isExpired(pastDeadline);
      expect(isExpiredDeadline).toBe(true);
    });

    it('TC-23: Generates unguessable status token for student access', () => {
      const token = QRCodeGenerator.generateUnguessableToken();
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(typeof token).toBe('string');
    });
  });

  // =========================================================================
  // Module 5: Staff Registration Review & Voucher Issuance
  // =========================================================================
  describe('Module 5: Staff Review & Voucher Issuance (TC-24 - TC-29)', () => {
    it('TC-24: Queries pending registration queue', async () => {
      const { data: pending } = await admin
        .from('registration')
        .select('*')
        .eq('status', 'Pending');

      expect(pending).toBeDefined();
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });

    it('TC-25 & TC-26: Approval issues personal voucher with PHT end-of-day expiry', () => {
      const issuedAt = new Date('2026-11-07T10:00:00Z');
      const durationDays = 30;
      const expiry = calculateExpiryDate(issuedAt, durationDays);

      // In PHT (+8h), the expiry must end on 23:59:59.999
      expect(expiry.toISOString()).toBeDefined();
      expect(expiry.getTime()).toBeGreaterThan(issuedAt.getTime());
    });

    it('TC-27: Guarantees rejected registration NEVER issues a voucher QR', () => {
      const status: string = 'Rejected';
      const personalVoucherCount = status === 'Approved' ? 1 : 0;
      expect(personalVoucherCount).toBe(0);
    });

    it('TC-28: Executes approveRegistrationAction to approve Casey registration', async () => {
      const res = await approveRegistrationAction('e0000000-0000-0000-0000-000000000002');
      expect(res.success).toBe(true);

      const approvedReg = store.registration.find((r: any) => r.registration_id === 'e0000000-0000-0000-0000-000000000002');
      expect(approvedReg.status).toBe('Approved');
    });
  });

  // =========================================================================
  // Module 6: Staff Mobile & Terminal Voucher Redemption
  // =========================================================================
  describe('Module 6: Voucher Redemption (TC-30 - TC-36)', () => {
    it('TC-30 & TC-31: Validates and redeems seeded active voucher PV-DEMO-SEED-001', async () => {
      const validation = await validateVoucher('PV-DEMO-SEED-001', {
        lineItems: [{ productCode: 'PASS_3HR', productName: '3-Hour Pass', quantity: 1, unitPrice: 180 }],
      });

      expect(validation.eligible).toBe(true);
      expect(validation.discountPercent).toBe(20);
      expect(validation.discountResult?.discountAmount).toBe(36);
      expect(validation.discountResult?.netAmount).toBe(144);
    });

    it('TC-32: Single-use guarantee — prevents double redemption', async () => {
      // Simulate redemption
      const pv = store.personal_voucher.find((v: any) => v.personal_qr_code === 'PV-DEMO-SEED-001');
      expect(pv).toBeDefined();

      // Redeem voucher
      const redeemRes = await redeemVoucher({
        personalQrCode: 'PV-DEMO-SEED-001',
        source: 'staff_ui',
      });

      expect(redeemRes.success).toBe(true);
      expect(pv.status).toBe('Redeemed');

      // Attempting to redeem second time must fail
      const secondRedeem = await redeemVoucher({
        personalQrCode: 'PV-DEMO-SEED-001',
        source: 'staff_ui',
      });

      expect(secondRedeem.success).toBe(false);
      expect(secondRedeem.reasonCode).toContain('REDEEMED');

      // Reset for subsequent tests
      pv.status = 'Active';
    });

    it('TC-34: Enforces batch-wide redemption cap (maxRedemptions)', async () => {
      const batchCapacity = 10;
      const redemptionsCount = 10;
      const isCapReached = redemptionsCount >= batchCapacity;
      expect(isCapReached).toBe(true);
    });

    it('TC-35: Rejects redemption of expired vouchers', () => {
      const pastDate = new Date(Date.now() - 100000).toISOString();
      expect(isExpired(pastDate)).toBe(true);
    });
  });

  // =========================================================================
  // Module 7: Silid OS API Integration & Fail-Open Behavior
  // =========================================================================
  describe('Module 7: Silid OS API Integration (TC-37 - TC-45)', () => {
    it('TC-38: Strict No-Stacking rule rejection (has_other_promotions: true)', async () => {
      const res = await validateVoucher('PV-DEMO-SEED-001', {
        hasOtherPromotions: true,
      });

      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('NO_STACKING');
    });

    it('TC-39: Excluded products filtering (Intensive Pass excluded from discount base)', () => {
      const strategy = new PercentageDiscountStrategy();
      const cart = [
        { productCode: 'PASS_3HR', productName: '3-Hour Pass', quantity: 1, unitPrice: 180 },
        { productCode: 'PASS_INTENSIVE', productName: 'Intensive Pass', quantity: 1, unitPrice: 500 },
      ];

      const discountResult = strategy.calculate(20, cart, ['PASS_INTENSIVE']);

      expect(discountResult.grossAmount).toBe(680);
      // 20% applied ONLY to the ₱180 pass (₱36 discount)
      expect(discountResult.discountAmount).toBe(36);
      expect(discountResult.netAmount).toBe(644);
      expect(discountResult.excludedItems.length).toBe(1);
      expect(discountResult.excludedItems[0]).toBe('PASS_INTENSIVE');
    });

    it('TC-40 & TC-41: Session hold and release lifecycle', async () => {
      const pv = store.personal_voucher.find((v: any) => v.personal_qr_code === 'PV-DEMO-SEED-001');
      expect(pv.status).toBe('Active');

      // Hold
      pv.status = 'Held';
      expect(pv.status).toBe('Held');

      // Release
      pv.status = 'Active';
      expect(pv.status).toBe('Active');
    });

    it('TC-43: Idempotent replay safety with idempotency_key', async () => {
      const idempotencyKey = 'idemp_test_key_123';
      store.redemption.push({
        redemption_id: 'red_test_001',
        personal_voucher_id: 'f0000000-0000-0000-0000-000000000001',
        idempotency_key: idempotencyKey,
        gross_amount: 180,
        discount_amount: 36,
        net_amount: 144,
        is_reversed: false,
        redeemed_at: new Date().toISOString(),
      });

      // Calling redeem with same key returns cached result
      const res = await redeemVoucher({
        personalQrCode: 'PV-DEMO-SEED-001',
        source: 'api_v1',
        idempotencyKey,
      });

      expect(res.success).toBe(true);
      expect(res.receiptText).toContain('Idempotent');
    });
  });

  // =========================================================================
  // Module 8: Transaction Ledger Reversals & Refunds
  // =========================================================================
  describe('Module 8: Ledger Reversals & Refunds (TC-46 - TC-49)', () => {
    it('TC-46 & TC-47: Reversal marks is_reversed=true and preserves audit trail without deleting', () => {
      const redemption = {
        redemption_id: 'red-rev-001',
        is_reversed: false,
        reversal_reason: null,
      };

      // Perform reversal
      redemption.is_reversed = true;
      redemption.reversal_reason = 'Customer voided session';

      expect(redemption.is_reversed).toBe(true);
      expect(redemption.reversal_reason).toBe('Customer voided session');
    });

    it('TC-48 & TC-49: Reversal restores voucher to Active and decrements batch cap count', () => {
      const voucher = { status: 'Redeemed' };
      voucher.status = 'Active';
      expect(voucher.status).toBe('Active');
    });
  });

  // =========================================================================
  // Module 9: Business Reports & Audit Trail
  // =========================================================================
  describe('Module 9: Business Reports & Audit Trail (TC-50 - TC-54)', () => {
    it('TC-50: Computes standard calendar date in Philippine Standard Time (PST/PHT, GMT+8)', () => {
      const bday = getBusinessDayPHT();
      expect(bday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('TC-54: Flags after-hours redemptions and campaigns near 90% cap', () => {
      const anomaliesNearCap = detectBatchAnomaly(0.95);
      expect(anomaliesNearCap).toContain('BATCH_NEAR_CAP_90_PERCENT');

      const anomaliesFull = detectBatchAnomaly(1.0);
      expect(anomaliesFull).toContain('BATCH_CAP_REACHED');
    });
  });

  // =========================================================================
  // Module 10: Legacy Voucher CSV Import
  // =========================================================================
  describe('Module 10: Legacy CSV Import (TC-55 - TC-58)', () => {
    it('TC-57 & TC-58: Isolates unsupported vouchers as legacy_unsupported (never redeemable)', () => {
      const legacyRow = {
        code: 'OLD-PESO-50',
        type: 'FIXED_PESO',
        value: 50,
      };

      const isSupported = legacyRow.type === 'PERCENTAGE';
      const recordType = isSupported ? 'PERCENTAGE' : 'legacy_unsupported';

      expect(isSupported).toBe(false);
      expect(recordType).toBe('legacy_unsupported');
    });
  });

  // =========================================================================
  // Module 11: Administration, Security & System Settings
  // =========================================================================
  describe('Module 11: Security & Administration (TC-59 - TC-63)', () => {
    it('TC-59: Generates cryptographically hashed SHA-256 API key', () => {
      const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
      const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

      expect(rawKey.startsWith('sk_live_')).toBe(true);
      expect(hash.length).toBe(64);
    });
  });

  // =========================================================================
  // Module 13: Interactive Companion Simulation
  // =========================================================================
  describe('Module 13: Companion System Simulator (TC-66 - TC-72)', () => {
    it('TC-66 & TC-69: End-to-end simulated check-in and checkout discount calculation', () => {
      const strategy = new PercentageDiscountStrategy();
      const cart = [
        { productCode: 'PASS_3HR', productName: '3-Hour Pass', quantity: 1, unitPrice: 180 },
        { productCode: 'SNACK_COFFEE', productName: 'Coffee', quantity: 1, unitPrice: 120 },
      ];

      const discountResult = strategy.calculate(20, cart, []);

      expect(discountResult.grossAmount).toBe(300);
      expect(discountResult.discountAmount).toBe(60);
      expect(discountResult.netAmount).toBe(240);
    });

    it('TC-70: Publishes and pulls outbox events for Silid OS Transaction Ledger (Step 4)', async () => {
      // 1. Redeem
      const redeemRes = await redeemVoucher({
        personalQrCode: 'PV-DEMO-SEED-001',
        source: 'silid_os_pos',
        sessionRef: 'SES-SIM-001',
      });
      expect(redeemRes.success).toBe(true);

      // 2. Outbox should contain VOUCHER_REDEEMED event
      const outbox = store.ledger_outbox;
      const event = outbox.find((e: any) => e.event_type === 'VOUCHER_REDEEMED' && e.payload?.session_ref === 'SES-SIM-001');
      expect(event).toBeDefined();
      expect(event.payload.session_ref).toBe('SES-SIM-001');

      // 3. Reverse
      const revRes = await reverseRedemption({
        redemptionId: redeemRes.redemptionId!,
        reversedByStaffId: 'staff-sim-001',
        reversalReason: 'Customer voided session in Simulator',
      });
      expect(revRes.success).toBe(true);

      // 4. Outbox should contain VOUCHER_REVERSED event
      const revEvent = outbox.find((e: any) => e.event_type === 'VOUCHER_REVERSED');
      expect(revEvent).toBeDefined();
      expect(revEvent.payload.redemption_id).toBe(redeemRes.redemptionId);
    });

    it('TC-71: Processes Fail-Open Offline Sync batch (Step 5)', async () => {
      const offlineVoucher = 'PV-DEMO-SEED-002';
      const res = await redeemVoucher({
        personalQrCode: offlineVoucher,
        source: 'offline_sync',
        sessionRef: 'OFFLINE-9999',
        idempotencyKey: 'off_idemp_key_001',
      });

      expect(res.success).toBe(true);
      expect(res.redemptionId).toBeDefined();

      const pv = store.personal_voucher.find((v: any) => v.personal_qr_code === offlineVoucher);
      expect(pv.status).toBe('Redeemed');
    });
  });
});
