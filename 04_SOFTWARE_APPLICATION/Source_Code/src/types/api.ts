import type { LineItem, DiscountResult } from '@/lib/pricing';

export interface ValidateRequestBody {
  personal_qr_code: string;
  member_ref?: string;
  session_ref?: string;
  line_items?: LineItem[];
  has_other_promotions?: boolean;
}

export interface ValidateResponseBody {
  eligible: boolean;
  reason_code?: string;
  message?: string;
  voucher_id?: string;
  template_name?: string;
  discount_percent?: number;
  discount_amount?: number;
  gross_amount?: number;
  net_amount?: number;
  expiry_date?: string;
  response_ms?: number;
}

export interface RedeemRequestBody {
  personal_qr_code: string;
  member_ref?: string;
  session_ref?: string;
  idempotency_key?: string;
  line_items?: LineItem[];
  has_other_promotions?: boolean;
}

export interface RedeemResponseBody {
  success: boolean;
  redemption_id?: string;
  receipt_text?: string;
  discount_amount?: number;
  gross_amount?: number;
  net_amount?: number;
  discount_percent?: number;
  reason_code?: string;
  message?: string;
}

export interface HoldRequestBody {
  personal_qr_code: string;
  session_ref: string;
  idempotency_key?: string;
  line_items?: LineItem[];
  has_other_promotions?: boolean;
}

export interface ReleaseRequestBody {
  personal_qr_code: string;
  session_ref: string;
  idempotency_key?: string;
}

export interface ReverseRequestBody {
  redemption_id: string;
  reversal_reason: string;
  idempotency_key?: string;
}

export interface OfflineSyncEntry {
  personal_qr_code: string;
  idempotency_key: string;
  session_ref?: string;
  redeemed_at?: string;
}

export interface RegisterRequestBody {
  claim_code: string;
  student_id: string;
  student_name: string;
  email: string;
  mobile_number?: string;
  dpa_consent: boolean;
}
