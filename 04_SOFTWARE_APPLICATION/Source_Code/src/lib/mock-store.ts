/**
 * In-Memory Database Store for Zero-Dependency / Offline Mock Mode
 * Allows full demonstration of all 5 diagram flows without an external Supabase instance.
 */

export interface MockStore {
  staff: any[];
  voucher_template: any[];
  voucher_batch: any[];
  claim_ticket: any[];
  student: any[];
  registration: any[];
  personal_voucher: any[];
  redemption: any[];
  feature_flag: any[];
  api_key: any[];
  audit_log: any[];
  ledger_outbox: any[];
  email_outbox: any[];
  legacy_voucher: any[];
}

const globalMock = globalThis as unknown as { __SILID_MOCK_STORE__?: MockStore };

function initStore(): MockStore {
  return {
    staff: [
      {
        staff_id: 'a0000000-0000-0000-0000-000000000001',
        staff_name: 'Admin Founder',
        email: 'founder@silid.ph',
        role: 'Founder',
        created_at: new Date().toISOString(),
      },
      {
        staff_id: 'a0000000-0000-0000-0000-000000000002',
        staff_name: 'Sample Staff',
        email: 'staff@silid.ph',
        role: 'Staff',
        created_at: new Date().toISOString(),
      },
    ],
    voucher_template: [
      {
        template_id: 'b0000000-0000-0000-0000-000000000001',
        created_by_staff_id: 'a0000000-0000-0000-0000-000000000001',
        template_name: '30-Day Focus Access Privilege',
        benefit_type: 'PERCENTAGE',
        benefit_value: 20,
        effective_duration: 30,
        restrictions: 'Not valid for Intensive Pass or Hub Reservations',
        excluded_products: ['Intensive Pass', 'Hub Reservations'],
        description: 'Partner event promotional voucher – 20% discount for 30 days.',
        status: 'Active',
        created_at: new Date().toISOString(),
      },
      {
        template_id: 'b0000000-0000-0000-0000-000000000002',
        created_by_staff_id: 'a0000000-0000-0000-0000-000000000001',
        template_name: 'Sample Loyalty Discount',
        benefit_type: 'PERCENTAGE',
        benefit_value: 10,
        effective_duration: 14,
        restrictions: 'Returning members only',
        excluded_products: ['Intensive Pass', 'Hub Reservations'],
        description: 'Loyalty – 10% discount for 14 days.',
        status: 'Active',
        created_at: new Date().toISOString(),
      },
    ],
    voucher_batch: [
      {
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        template_id: 'b0000000-0000-0000-0000-000000000001',
        created_by_staff_id: 'a0000000-0000-0000-0000-000000000001',
        event_name: 'Youth on the Rock Campus Gathering 2026',
        event_date: '2026-12-01',
        claim_deadline: '2026-12-15',
        batch_quantity: 10,
        max_redemptions: 10,
        status: 'Active',
        code_prefix: 'CT-YTR',
        created_at: new Date().toISOString(),
      },
    ],
    claim_ticket: [
      {
        claim_ticket_id: 'd0000000-0000-0000-0000-000000000001',
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        claim_code: 'CT-YTR-001',
        qr_code_data: 'http://localhost:3000/register/CT-YTR-001',
        status: 'Claimed',
        created_at: new Date().toISOString(),
      },
      {
        claim_ticket_id: 'd0000000-0000-0000-0000-000000000002',
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        claim_code: 'CT-YTR-002',
        qr_code_data: 'http://localhost:3000/register/CT-YTR-002',
        status: 'Claimed',
        created_at: new Date().toISOString(),
      },
      {
        claim_ticket_id: 'd0000000-0000-0000-0000-000000000003',
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        claim_code: 'CT-YTR-003',
        qr_code_data: 'http://localhost:3000/register/CT-YTR-003',
        status: 'Available',
        created_at: new Date().toISOString(),
      },
      {
        claim_ticket_id: 'd0000000-0000-0000-0000-000000000004',
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        claim_code: 'CT-YTR-004',
        qr_code_data: 'http://localhost:3000/register/CT-YTR-004',
        status: 'Available',
        created_at: new Date().toISOString(),
      },
      {
        claim_ticket_id: 'd0000000-0000-0000-0000-000000000005',
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        claim_code: 'CT-YTR-005',
        qr_code_data: 'http://localhost:3000/register/CT-YTR-005',
        status: 'Available',
        created_at: new Date().toISOString(),
      },
    ],
    student: [
      {
        student_id: 'STU-2024-001',
        student_name: 'Jamie Dela Cruz',
        email: 'jamie@example.invalid',
        mobile_number: '09171234567',
        silid_member_ref: 'MEM-001',
        created_at: new Date().toISOString(),
      },
      {
        student_id: 'STU-2024-002',
        student_name: 'Casey Reyes',
        email: 'casey@example.invalid',
        mobile_number: '09181234567',
        silid_member_ref: 'MEM-002',
        created_at: new Date().toISOString(),
      },
    ],
    registration: [
      {
        registration_id: 'e0000000-0000-0000-0000-000000000001',
        student_id: 'STU-2024-001',
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        claim_ticket_id: 'd0000000-0000-0000-0000-000000000001',
        reviewed_by_staff_id: 'a0000000-0000-0000-0000-000000000001',
        status: 'Approved',
        rejection_reason: null,
        status_token: 'demo-token-approved-jamie-001',
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      },
      {
        registration_id: 'e0000000-0000-0000-0000-000000000002',
        student_id: 'STU-2024-002',
        batch_id: 'c0000000-0000-0000-0000-000000000001',
        claim_ticket_id: 'd0000000-0000-0000-0000-000000000002',
        reviewed_by_staff_id: null,
        status: 'Pending',
        rejection_reason: null,
        status_token: 'demo-token-pending-casey-002',
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
      },
    ],
    personal_voucher: [
      {
        personal_voucher_id: 'f0000000-0000-0000-0000-000000000001',
        registration_id: 'e0000000-0000-0000-0000-000000000001',
        issued_by_staff_id: 'a0000000-0000-0000-0000-000000000001',
        personal_qr_code: 'PV-DEMO-SEED-001',
        issued_at: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'Active',
      },
    ],
    redemption: [],
    feature_flag: [
      { flag_id: '1', flag_key: 'api_v1_validate', is_enabled: true, description: 'Validate endpoint' },
      { flag_id: '2', flag_key: 'api_v1_hold', is_enabled: true, description: 'Hold/release endpoints' },
      { flag_id: '3', flag_key: 'api_v1_redeem', is_enabled: true, description: 'Redeem endpoint' },
      { flag_id: '4', flag_key: 'api_v1_reverse', is_enabled: true, description: 'Reverse endpoint' },
      { flag_id: '5', flag_key: 'api_v1_ledger_events', is_enabled: true, description: 'Ledger pull' },
      { flag_id: '6', flag_key: 'email_delivery', is_enabled: true, description: 'Email delivery' },
      { flag_id: '7', flag_key: 'api_v1_start_session', is_enabled: true, description: 'Start Session' },
      { flag_id: '8', flag_key: 'api_v1_active_sessions', is_enabled: true, description: 'Active Sessions' },
      { flag_id: '9', flag_key: 'api_v1_checkout', is_enabled: true, description: 'Checkout' },
    ],
    api_key: [
      {
        api_key_id: 'k0000000-0000-0000-0000-000000000001',
        key_name: 'Silid OS Dev Key',
        // sha256 of "sk_live_demo123"
        key_hash: '59f972ef75e9b7222496a759be1c56fa76db17d31298495a894a821e2e7b51fa',
        is_active: true,
        rate_limit_per_minute: 60,
        created_at: new Date().toISOString(),
      },
    ],
    audit_log: [],
    ledger_outbox: [],
    email_outbox: [],
    legacy_voucher: [],
  };
}

export function getMockStore(): MockStore {
  if (!globalMock.__SILID_MOCK_STORE__) {
    globalMock.__SILID_MOCK_STORE__ = initStore();
  }
  return globalMock.__SILID_MOCK_STORE__;
}
