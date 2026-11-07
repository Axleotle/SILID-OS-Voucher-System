import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { validateVoucher } from '@/lib/voucher-validator';
import { isFeatureEnabled } from '@/lib/feature-flags';

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
  member_ref: z.string().optional(),
  session_ref: z.string().optional(),
  line_items: z.array(lineItemSchema).optional(),
  has_other_promotions: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled('api_v1_validate'))) {
    return apiError('FEATURE_DISABLED', 'Validate endpoint is disabled.', 503);
  }

  const auth = await authenticateApiKey(req);
  if (!auth.success) {
    return apiError(auth.errorCode!, auth.errorMessage!, 401);
  }

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

  const start = Date.now();
  const result = await validateVoucher(parsed.data.personal_qr_code, {
    memberRef: parsed.data.member_ref,
    sessionRef: parsed.data.session_ref,
    lineItems: parsed.data.line_items,
    hasOtherPromotions: parsed.data.has_other_promotions,
  });
  const elapsed = Date.now() - start;

  // 200 with eligible:false is intentional — Silid OS handles the UI messaging
  if (!result.eligible) {
    return NextResponse.json(
      {
        eligible: false,
        reason_code: result.reasonCode,
        message: result.reasonMessage,
        response_ms: elapsed,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      eligible: true,
      voucher_id: result.voucherId,
      template_name: result.templateName,
      discount_percent: result.discountPercent,
      discount_amount: result.discountResult?.discountAmount,
      gross_amount: result.discountResult?.grossAmount,
      net_amount: result.discountResult?.netAmount,
      expiry_date: result.expiryDate,
      response_ms: elapsed,
    },
    { status: 200 },
  );
}
