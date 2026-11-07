import { NextRequest, NextResponse } from 'next/server';
import { runExpireVouchersJob } from '@/jobs/expire-vouchers';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runExpireVouchersJob();
  return NextResponse.json(result);
}
