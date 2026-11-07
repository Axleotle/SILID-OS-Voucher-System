import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  personal_qr_code: z.string().min(1),
  session_ref: z.string().min(1),
  idempotency_key: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Shares the api_v1_hold flag — hold/release are coupled features
  if (!(await isFeatureEnabled('api_v1_hold'))) {
    return apiError('FEATURE_DISABLED', 'Release endpoint is disabled.', 503);
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
  const { data: voucher } = await admin
    .from('personal_voucher')
    .select('personal_voucher_id, status')
    .eq('personal_qr_code', parsed.data.personal_qr_code)
    .single();

  if (!voucher) return apiError('NOT_FOUND', 'Voucher not found.', 404);

  // Idempotent: if the voucher is already Active it was already released — that's fine
  if (voucher.status === 'Active') {
    return NextResponse.json(
      { released: true, note: 'Voucher was already active.' },
      { status: 200 },
    );
  }

  if (voucher.status !== 'Held') {
    return apiError(
      'INVALID_STATE',
      `Cannot release a voucher with status '${voucher.status}'.`,
      422,
    );
  }

  const { error } = await admin
    .from('personal_voucher')
    .update({ status: 'Active' })
    .eq('personal_voucher_id', voucher.personal_voucher_id);

  if (error) return apiError('DB_ERROR', error.message, 500);

  writeAuditLog({
    action: 'VOUCHER_RELEASED',
    entityType: 'personal_voucher',
    entityId: voucher.personal_voucher_id,
    afterValue: { session_ref: parsed.data.session_ref },
  }).catch(() => {});

  return NextResponse.json({ released: true }, { status: 200 });
}
