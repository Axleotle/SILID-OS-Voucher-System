import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { reverseRedemption } from '@/lib/voucher-validator';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  redemption_id: z.string().optional(),
  personal_qr_code: z.string().optional(),
  session_ref: z.string().optional(),
  reversal_reason: z.string().optional(),
  reason: z.string().optional(),
  idempotency_key: z.string().optional(),
}).refine((data) => data.redemption_id || data.personal_qr_code || data.session_ref, {
  message: 'Must provide either redemption_id, personal_qr_code, or session_ref.',
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

  const admin = createAdminClient();
  let targetRedemptionId = parsed.data.redemption_id;
  const reason = parsed.data.reversal_reason || parsed.data.reason || 'Reversed via API / Silid OS';

  // If redemption_id was not explicitly passed, resolve it by session_ref or personal_qr_code
  if (!targetRedemptionId) {
    if (parsed.data.session_ref) {
      const { data: found } = await admin
        .from('redemption')
        .select('redemption_id')
        .eq('session_ref', parsed.data.session_ref)
        .eq('is_reversed', false)
        .order('redeemed_at', { ascending: false })
        .limit(1);

      if (found && found.length > 0) {
        targetRedemptionId = found[0].redemption_id;
      }
    }

    if (!targetRedemptionId && parsed.data.personal_qr_code) {
      const { data: pv } = await admin
        .from('personal_voucher')
        .select('personal_voucher_id')
        .eq('personal_qr_code', parsed.data.personal_qr_code)
        .maybeSingle();

      if (pv) {
        const { data: rList } = await admin
          .from('redemption')
          .select('redemption_id')
          .eq('personal_voucher_id', pv.personal_voucher_id)
          .eq('is_reversed', false)
          .order('redeemed_at', { ascending: false })
          .limit(1);

        if (rList && rList.length > 0) {
          targetRedemptionId = rList[0].redemption_id;
        }
      }
    }
  }

  if (!targetRedemptionId) {
    return apiError('NOT_FOUND', 'No active redemption found to reverse.', 404);
  }

  const result = await reverseRedemption({
    redemptionId: targetRedemptionId,
    // Use the authenticated key's ID as the actor (API callers have no staff session)
    reversedByStaffId: auth.keyId!,
    reversalReason: reason,
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
      redemption_id: targetRedemptionId,
      message: 'Redemption successfully reversed. Voucher restored to Active.',
    },
    { status: 200 },
  );
}
