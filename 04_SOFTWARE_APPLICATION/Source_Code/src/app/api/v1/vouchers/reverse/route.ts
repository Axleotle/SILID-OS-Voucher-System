import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { reverseRedemption } from '@/lib/voucher-validator';
import { isFeatureEnabled } from '@/lib/feature-flags';

const schema = z.object({
  redemption_id: z.string().uuid(),
  reversal_reason: z.string().min(1),
  idempotency_key: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled('api_v1_reverse'))) {
    return apiError('FEATURE_DISABLED', 'Reverse endpoint is disabled.', 503);
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

  const result = await reverseRedemption({
    redemptionId: parsed.data.redemption_id,
    // Use the authenticated key's ID as the actor (API callers have no staff session)
    reversedByStaffId: auth.keyId!,
    reversalReason: parsed.data.reversal_reason,
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
      redemption_id: parsed.data.redemption_id,
    },
    { status: 200 },
  );
}
