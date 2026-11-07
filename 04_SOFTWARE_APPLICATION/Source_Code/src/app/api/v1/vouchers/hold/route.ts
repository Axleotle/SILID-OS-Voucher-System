import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { validateVoucher } from '@/lib/voucher-validator';
import { writeAuditLog } from '@/lib/audit';

const lineItemSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    return {
      productCode: val.productCode || val.product_code || 'ITEM',
      productName: val.productName || val.product_name || val.description || 'Study Pass Item',
      quantity: val.quantity !== undefined ? Number(val.quantity) : 1,
      unitPrice: val.unitPrice !== undefined ? Number(val.unitPrice) : (val.price !== undefined ? Number(val.price) : 0),
    };
  }
  return val;
}, z.object({
  productCode: z.string(),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
}));

const schema = z.object({
  personal_qr_code: z.string().min(1),
  session_ref: z.string().min(1),
  idempotency_key: z.string().optional(),
  line_items: z.array(lineItemSchema).optional(),
  has_other_promotions: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled('api_v1_hold'))) {
    return apiError('FEATURE_DISABLED', 'Hold endpoint is disabled.', 503);
  }

  const auth = await authenticateApiKey(req);
  if (!auth.success) return apiError(auth.errorCode!, auth.errorMessage!, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join('; '),
      400,
    );
  }

  // Validate eligibility before placing the hold
  const validation = await validateVoucher(parsed.data.personal_qr_code, {
    sessionRef: parsed.data.session_ref,
    lineItems: parsed.data.line_items,
    hasOtherPromotions: parsed.data.has_other_promotions,
  });

  if (!validation.eligible) {
    return NextResponse.json(
      {
        held: false,
        reason_code: validation.reasonCode,
        message: validation.reasonMessage,
      },
      { status: 422 },
    );
  }

  // Atomically mark the voucher as Held (only if currently Active — idempotent guard)
  const admin = createAdminClient();
  const { error } = await admin
    .from('personal_voucher')
    .update({ status: 'Held' })
    .eq('personal_qr_code', parsed.data.personal_qr_code)
    .eq('status', 'Active');

  if (error) return apiError('DB_ERROR', error.message, 500);

  writeAuditLog({
    action: 'VOUCHER_HELD',
    entityType: 'personal_voucher',
    entityId: validation.voucherId!,
    afterValue: { session_ref: parsed.data.session_ref },
  }).catch(() => {});

  return NextResponse.json(
    {
      held: true,
      voucher_id: validation.voucherId,
      discount_percent: validation.discountPercent,
      expiry_date: validation.expiryDate,
    },
    { status: 200 },
  );
}
