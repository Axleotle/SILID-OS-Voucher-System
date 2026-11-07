import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { redeemVoucher } from '@/lib/voucher-validator';

const entrySchema = z.object({
  personal_qr_code: z.string().min(1),
  /** Idempotency key is mandatory for offline sync to guarantee exactly-once processing. */
  idempotency_key: z.string().min(1),
  session_ref: z.string().optional(),
  redeemed_at: z.string().optional(),
});

const schema = z.object({
  entries: z.array(entrySchema).optional(),
  redemptions: z.array(entrySchema).optional(),
}).refine((data) => (data.entries && data.entries.length > 0) || (data.redemptions && data.redemptions.length > 0), {
  message: 'Must provide an entries or redemptions array.',
}).transform((data) => ({
  entries: (data.entries || data.redemptions)!,
}));

export async function POST(req: NextRequest) {
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

  // Process all entries concurrently; idempotency keys make retries safe
  const results = await Promise.allSettled(
    parsed.data.entries.map((entry) =>
      redeemVoucher({
        personalQrCode: entry.personal_qr_code,
        source: 'offline_sync',
        sessionRef: entry.session_ref,
        idempotencyKey: entry.idempotency_key,
        ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      }),
    ),
  );

  const summary = results.map((r, i) => ({
    idempotency_key: parsed.data.entries[i].idempotency_key,
    personal_qr_code: parsed.data.entries[i].personal_qr_code,
    success: r.status === 'fulfilled' ? r.value.success : false,
    reason_code:
      r.status === 'fulfilled'
        ? r.value.reasonCode
        : 'INTERNAL_ERROR',
    message:
      r.status === 'fulfilled'
        ? r.value.reasonMessage
        : (r as PromiseRejectedResult).reason?.message,
    redemption_id:
      r.status === 'fulfilled' ? r.value.redemptionId : undefined,
  }));

  return NextResponse.json(
    {
      processed: summary.length,
      succeeded: summary.filter((s) => s.success).length,
      failed: summary.filter((s) => !s.success).length,
      results: summary,
    },
    { status: 200 },
  );
}
