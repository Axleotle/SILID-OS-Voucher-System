import { NextRequest, NextResponse } from 'next/server';
import { runProcessOutboxJob } from '@/jobs/process-outbox';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runProcessOutboxJob();
  return NextResponse.json(result);
}
