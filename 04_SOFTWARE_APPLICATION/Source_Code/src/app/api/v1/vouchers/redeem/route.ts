import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { redeemVoucher } from '@/lib/voucher-validator';
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
  idempotency_key: z.string().optional(),
  line_items: z.array(lineItemSchema).optional(),
  has_other_promotions: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled('api_v1_redeem'))) {
    return apiError('FEATURE_DISABLED', 'Redeem endpoint is disabled.', 503);
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

  const result = await redeemVoucher({
    personalQrCode: parsed.data.personal_qr_code,
    source: 'api_v1',
    sessionRef: parsed.data.session_ref,
    idempotencyKey: parsed.data.idempotency_key,
    lineItems: parsed.data.line_items,
    hasOtherPromotions: parsed.data.has_other_promotions,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        reason_code: result.reasonCode,
        message: result.reasonMessage,
      },
      { status: 422 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      redemption_id: result.redemptionId,
      receipt_text: result.receiptText,
      discount_amount: result.discountResult?.discountAmount,
      gross_amount: result.discountResult?.grossAmount,
      net_amount: result.discountResult?.netAmount,
      discount_percent: result.discountResult?.discountPercent,
    },
    { status: 200 },
  );
}
