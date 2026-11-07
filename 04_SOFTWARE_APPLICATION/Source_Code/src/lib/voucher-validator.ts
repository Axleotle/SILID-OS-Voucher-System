import { createAdminClient } from './supabase/admin';
import { getEnabledStrategy } from './pricing';
import { isExpired } from './timezone';
import { writeAuditLog, detectRedemptionAnomalies } from './audit';
import type { LineItem, DiscountResult } from './pricing';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ValidationContext {
  /** Silid OS member reference */
  memberRef?: string;
  sessionRef?: string;
  lineItems?: LineItem[];
  hasOtherPromotions?: boolean;
}

export interface ValidationResult {
  eligible: boolean;
  reasonCode?: string;
  reasonMessage?: string;
  discountPercent?: number;
  discountResult?: DiscountResult;
  voucherId?: string;
  expiryDate?: string;
  templateName?: string;
}

export interface RedemptionResult {
  success: boolean;
  redemptionId?: string;
  discountResult?: DiscountResult;
  receiptText?: string;
  reasonCode?: string;
  reasonMessage?: string;
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

/**
 * Validate a personal voucher QR code for eligibility.
 * Does NOT lock or change state — read-only check for display in POS UI.
 */
export async function validateVoucher(
  personalQrCode: string,
  context: ValidationContext,
): Promise<ValidationResult> {
  const admin = createAdminClient();

  // Stacking check: reject if other promotions already apply
  if (context.hasOtherPromotions) {
    return {
      eligible: false,
      reasonCode: 'NO_STACKING',
      reasonMessage: 'Vouchers cannot be combined with other promotions.',
    };
  }

  // Look up voucher with all related data in a single query
  const { data: voucher, error } = await admin
    .from('personal_voucher')
    .select(`
      personal_voucher_id,
      status,
      expiry_date,
      personal_qr_code,
      registration:registration_id (
        registration_id,
        student_id,
        status,
        batch:batch_id (
          batch_id,
          max_redemptions,
          status,
          template:template_id (
            template_id,
            template_name,
            benefit_type,
            benefit_value,
            excluded_products,
            status
          )
        )
      )
    `)
    .eq('personal_qr_code', personalQrCode)
    .single();

  if (error || !voucher) {
    return {
      eligible: false,
      reasonCode: 'VOUCHER_NOT_FOUND',
      reasonMessage: 'Voucher not found. Please check the QR code.',
    };
  }

  if (voucher.status !== 'Active') {
    const messages: Record<string, string> = {
      Redeemed: 'This voucher has already been redeemed.',
      Expired: 'This voucher has expired.',
      Cancelled: 'This voucher has been cancelled.',
      Held: 'This voucher is currently held for another session.',
    };
    return {
      eligible: false,
      reasonCode: `VOUCHER_${voucher.status.toUpperCase()}`,
      reasonMessage: messages[voucher.status] ?? 'Voucher is not active.',
    };
  }

  if (isExpired(new Date(voucher.expiry_date))) {
    return {
      eligible: false,
      reasonCode: 'VOUCHER_EXPIRED',
      reasonMessage: `This voucher expired on ${new Date(voucher.expiry_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}.`,
    };
  }

  // Resiliently resolve registration, batch, and template
  let reg = voucher.registration as any;
  if (!reg && (voucher as any).registration_id) {
    const { data: r } = await admin
      .from('registration')
      .select('*')
      .eq('registration_id', (voucher as any).registration_id)
      .single();
    reg = r;
  }

  let batch = reg?.batch as any;
  if (!batch && reg?.batch_id) {
    const { data: b } = await admin
      .from('voucher_batch')
      .select('*')
      .eq('batch_id', reg.batch_id)
      .single();
    batch = b;
  }

  let template = batch?.template as any;
  if (!template && batch?.template_id) {
    const { data: t } = await admin
      .from('voucher_template')
      .select('*')
      .eq('template_id', batch.template_id)
      .single();
    template = t;
  }

  if (!template || template.status !== 'Active') {
    return {
      eligible: false,
      reasonCode: 'TEMPLATE_INACTIVE',
      reasonMessage: 'The voucher template is no longer active.',
    };
  }

  if (!['Active', 'PartiallyUsed'].includes(batch?.status)) {
    return {
      eligible: false,
      reasonCode: 'BATCH_CLOSED',
      reasonMessage: 'The voucher batch is no longer accepting redemptions.',
    };
  }

  // Check batch cap (count non-reversed redemptions for this batch)
  const { data: batchRegs } = await admin
    .from('registration')
    .select('registration_id')
    .eq('batch_id', batch.batch_id);

  const regIds = new Set((batchRegs || []).map((r: any) => r.registration_id));

  const { data: allVouchers } = await admin
    .from('personal_voucher')
    .select('personal_voucher_id, registration_id');

  const batchVoucherIds = new Set(
    (allVouchers || [])
      .filter((v: any) => regIds.has(v.registration_id))
      .map((v: any) => v.personal_voucher_id)
  );

  const { data: redemptions } = await admin
    .from('redemption')
    .select('personal_voucher_id, is_reversed')
    .eq('is_reversed', false);

  const redeemedCount = (redemptions || []).filter((r: any) => batchVoucherIds.has(r.personal_voucher_id)).length;

  if (redeemedCount >= batch.max_redemptions) {
    return {
      eligible: false,
      reasonCode: 'BATCH_CAP_REACHED',
      reasonMessage: 'This voucher campaign has reached its maximum redemption limit.',
    };
  }

  // Calculate discount (only when line items are provided)
  const strategy = getEnabledStrategy(template.benefit_type);
  const excludedProducts: string[] = Array.isArray(template.excluded_products)
    ? template.excluded_products
    : [];
  const lineItems = context.lineItems ?? [];
  const discountResult = strategy.calculate(template.benefit_value, lineItems, excludedProducts);

  return {
    eligible: true,
    voucherId: voucher.personal_voucher_id,
    discountPercent: template.benefit_value,
    discountResult: lineItems.length > 0 ? discountResult : undefined,
    expiryDate: voucher.expiry_date,
    templateName: template.template_name,
  };
}

// ---------------------------------------------------------------------------
// Redeem
// ---------------------------------------------------------------------------

/**
 * Atomically redeem a voucher.
 *
 * Calls the `atomic_redeem_voucher` Postgres RPC which:
 *   1. Locks the batch row (FOR UPDATE NOWAIT)
 *   2. Locks the voucher row (FOR UPDATE NOWAIT)
 *   3. Re-validates all conditions after the lock (TOCTOU-safe)
 *   4. Inserts the redemption record
 *   5. Marks the voucher as Redeemed
 *   6. Updates batch status
 *
 * This function is shared by the staff UI and the API endpoint.
 */
export async function redeemVoucher(opts: {
  personalQrCode: string;
  processedByStaffId?: string;
  source: 'staff_ui' | 'api_v1' | 'offline_sync';
  sessionRef?: string;
  idempotencyKey?: string;
  lineItems?: LineItem[];
  hasOtherPromotions?: boolean;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<RedemptionResult> {
  const admin = createAdminClient();

  // Idempotency check: if we've already processed this key, return the cached result
  if (opts.idempotencyKey) {
    const { data: existing } = await admin
      .from('redemption')
      .select('redemption_id, personal_voucher_id, gross_amount, discount_amount, net_amount')
      .eq('idempotency_key', opts.idempotencyKey)
      .single();

    if (existing) {
      return {
        success: true,
        redemptionId: existing.redemption_id,
        receiptText: `[Idempotent] Redemption already processed: ${existing.redemption_id}`,
      };
    }
  }

  // Stacking check (fast path, before hitting the DB)
  if (opts.hasOtherPromotions) {
    return {
      success: false,
      reasonCode: 'NO_STACKING',
      reasonMessage: 'Vouchers cannot be combined with other promotions.',
    };
  }

  // Delegate to the Postgres atomic function (row-level locking handled inside)
  const { data, error } = await admin.rpc('atomic_redeem_voucher', {
    p_personal_qr_code: opts.personalQrCode,
    p_processed_by_staff_id: opts.processedByStaffId ?? null,
    p_source: opts.source,
    p_session_ref: opts.sessionRef ?? null,
    p_idempotency_key: opts.idempotencyKey ?? null,
    p_line_items: opts.lineItems ? JSON.stringify(opts.lineItems) : null,
    p_has_other_promotions: opts.hasOtherPromotions ?? false,
  });

  if (error) {
    // Parse structured error code embedded in the PG exception message: [CODE] text
    const msg = error.message ?? '';
    const codeMatch = msg.match(/\[([A-Z_]+)\]/);
    const code = codeMatch ? codeMatch[1] : 'REDEMPTION_FAILED';
    return {
      success: false,
      reasonCode: code,
      reasonMessage: msg.replace(/\[[A-Z_]+\]\s*/, ''),
    };
  }

  const result = data as any;

  // Write audit log asynchronously — do not block the response
  writeAuditLog({
    actorStaffId: opts.processedByStaffId,
    actorRole: opts.actorRole,
    action: 'VOUCHER_REDEEMED',
    entityType: 'redemption',
    entityId: result.redemption_id,
    afterValue: { personalQrCode: opts.personalQrCode, source: opts.source },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    anomalyFlags: detectRedemptionAnomalies({
      redeemedAt: new Date(),
      staffId: opts.processedByStaffId ?? 'api',
      batchUsedPercent: result.batch_used_percent ?? 0,
    }),
  }).catch(() => {});

  const discountResult: DiscountResult | undefined =
    result.discount_amount != null
      ? {
          grossAmount: result.gross_amount ?? 0,
          discountAmount: result.discount_amount ?? 0,
          netAmount: result.net_amount ?? 0,
          discountPercent: result.discount_percent ?? 0,
          appliedToItems: [],
          excludedItems: [],
        }
      : undefined;

  const receiptText = [
    `Voucher: ${opts.personalQrCode.slice(0, 12)}...`,
    `Discount: ${result.discount_percent ?? 0}%`,
    discountResult
      ? `(₱${discountResult.discountAmount.toFixed(2)} off) | Net: ₱${discountResult.netAmount.toFixed(2)}`
      : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    success: true,
    redemptionId: result.redemption_id,
    discountResult,
    receiptText,
  };
}

// ---------------------------------------------------------------------------
// Reverse
// ---------------------------------------------------------------------------

/**
 * Reverse a redemption.
 * Marks `is_reversed = true` and returns the voucher to `Active` status.
 * A reversed redemption does not count toward the batch cap.
 */
export async function reverseRedemption(opts: {
  redemptionId: string;
  reversedByStaffId: string;
  reversalReason: string;
  actorRole?: string;
}): Promise<{ success: boolean; reasonCode?: string; reasonMessage?: string }> {
  const admin = createAdminClient();

  const { data: redemption } = await admin
    .from('redemption')
    .select('redemption_id, is_reversed, personal_voucher_id')
    .eq('redemption_id', opts.redemptionId)
    .single();

  if (!redemption) {
    return { success: false, reasonCode: 'NOT_FOUND', reasonMessage: 'Redemption not found.' };
  }

  if (redemption.is_reversed) {
    return {
      success: false,
      reasonCode: 'ALREADY_REVERSED',
      reasonMessage: 'This redemption has already been reversed.',
    };
  }

  const now = new Date().toISOString();

  const { error: revError } = await admin
    .from('redemption')
    .update({
      is_reversed: true,
      reversed_at: now,
      reversed_by_staff_id: opts.reversedByStaffId,
      reversal_reason: opts.reversalReason,
    })
    .eq('redemption_id', opts.redemptionId);

  if (revError) {
    return { success: false, reasonCode: 'DB_ERROR', reasonMessage: revError.message };
  }

  // Return the voucher to Active so it can be redeemed again if needed
  const { error: vErr } = await admin
    .from('personal_voucher')
    .update({ status: 'Active' })
    .eq('personal_voucher_id', redemption.personal_voucher_id);

  if (vErr) {
    return { success: false, reasonCode: 'DB_ERROR', reasonMessage: vErr.message };
  }

  writeAuditLog({
    actorStaffId: opts.reversedByStaffId,
    actorRole: opts.actorRole,
    action: 'REDEMPTION_REVERSED',
    entityType: 'redemption',
    entityId: opts.redemptionId,
    afterValue: { reversalReason: opts.reversalReason },
  }).catch(() => {});

  return { success: true };
}
