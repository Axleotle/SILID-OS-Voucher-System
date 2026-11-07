import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, apiError } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFeatureEnabled } from '@/lib/feature-flags';

export async function GET(req: NextRequest) {
  if (!(await isFeatureEnabled('api_v1_ledger_events'))) {
    return apiError('FEATURE_DISABLED', 'Ledger events endpoint is disabled.', 503);
  }

  const auth = await authenticateApiKey(req);
  if (!auth.success) return apiError(auth.errorCode!, auth.errorMessage!, 401);

  const url = new URL(req.url);
  /** ISO 8601 timestamp — return only events sent after this point */
  const since = url.searchParams.get('since');
  /** Maximum number of events per page — capped at 200 */
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    200,
  );

  const admin = createAdminClient();
  let query = admin
    .from('ledger_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gt('created_at', since);
  }

  const { data, error } = await query;
  if (error) return apiError('DB_ERROR', error.message, 500);

  return NextResponse.json(
    {
      events: data ?? [],
      count: data?.length ?? 0,
    },
    { status: 200 },
  );
}
