export type BenefitType = 'PERCENTAGE' | 'LEGACY_UNSUPPORTED';
export type BatchStatus = 'Draft' | 'Active' | 'Paused' | 'Closed' | 'PartiallyUsed' | 'Exhausted';
export type TicketStatus = 'Available' | 'Claimed' | 'Cancelled';
export type RegistrationStatus = 'Pending' | 'Approved' | 'Rejected';
export type VoucherStatus = 'Active' | 'Held' | 'Redeemed' | 'Expired' | 'Cancelled';
export type StaffRole = 'Founder' | 'Manager' | 'Staff';
export type SourceType = 'staff_ui' | 'api_v1' | 'offline_sync';

export interface Staff {
  staff_id: string; staff_name: string; email: string;
  role: StaffRole; created_at: string; updated_at: string;
}
export interface VoucherTemplate {
  template_id: string; created_by_staff_id: string; template_name: string;
  benefit_type: BenefitType; benefit_value: number; effective_duration: number;
  restrictions: string | null; excluded_products: string[]; description: string | null;
  status: string; created_at: string; updated_at: string;
}
export interface VoucherBatch {
  batch_id: string; template_id: string; created_by_staff_id: string;
  event_name: string; event_date: string; claim_deadline: string;
  batch_quantity: number; max_redemptions: number; status: BatchStatus;
  code_prefix: string; created_at: string; updated_at: string;
}
export interface ClaimTicket {
  claim_ticket_id: string; batch_id: string; claim_code: string;
  qr_code_data: string; status: TicketStatus; created_at: string;
}
export interface Student {
  student_id: string; student_name: string; email: string;
  mobile_number: string | null; silid_member_ref: string | null;
  created_at: string; updated_at: string;
}
export interface Registration {
  registration_id: string; student_id: string; batch_id: string;
  claim_ticket_id: string; reviewed_by_staff_id: string | null;
  submitted_at: string; reviewed_at: string | null;
  status: RegistrationStatus; rejection_reason: string | null;
  status_token: string;
}
export interface PersonalVoucher {
  personal_voucher_id: string; registration_id: string;
  issued_by_staff_id: string; personal_qr_code: string;
  issued_at: string; expiry_date: string; status: VoucherStatus;
}
export interface Redemption {
  redemption_id: string; personal_voucher_id: string;
  processed_by_staff_id: string | null; redeemed_at: string;
  is_reversed: boolean; reversed_at: string | null;
  reversed_by_staff_id: string | null; reversal_reason: string | null;
  source: SourceType; session_ref: string | null;
  idempotency_key: string | null;
  gross_amount: number | null; discount_amount: number | null; net_amount: number | null;
}
export interface FeatureFlag {
  flag_id: string; flag_key: string; is_enabled: boolean;
  description: string | null; updated_by_staff_id: string | null; updated_at: string;
}
export interface AuditLog {
  audit_id: string; actor_staff_id: string | null; actor_role: string | null;
  action: string; entity_type: string; entity_id: string;
  before_value: unknown; after_value: unknown; reason: string | null;
  ip_address: string | null; user_agent: string | null;
  anomaly_flags: string[]; created_at: string;
}
