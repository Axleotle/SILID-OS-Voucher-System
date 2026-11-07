import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Scheduled job to deliver pending events in ledger_outbox to Silid OS webhook.
 * Signs each request using HMAC-SHA256(payload, LEDGER_WEBHOOK_SECRET).
 */
export async function runProcessOutboxJob() {
  const admin = createAdminClient();
  const webhookUrl = process.env.LEDGER_WEBHOOK_URL;
  const webhookSecret = process.env.LEDGER_WEBHOOK_SECRET || 'dev-secret';

  // Find up to 50 pending events
  const { data: pendingEvents, error } = await admin
    .from('ledger_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error || !pendingEvents || pendingEvents.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const entry of pendingEvents) {
    const payloadStr = JSON.stringify(entry.payload);
    const signature = crypto.createHmac('sha256', webhookSecret).update(payloadStr).digest('hex');

    if (!webhookUrl) {
      // If webhook URL is not yet configured by client, mark as sent/logged
      await admin
        .from('ledger_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_attempted_at: new Date().toISOString(),
          attempts: entry.attempts + 1,
          error_message: 'Webhook URL not configured; event retained for pull API.',
        })
        .eq('outbox_id', entry.outbox_id);
      succeeded++;
      continue;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Silid-Signature': signature,
          'X-Silid-Event': entry.event_type,
        },
        body: payloadStr,
      });

      if (res.ok) {
        await admin
          .from('ledger_outbox')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_attempted_at: new Date().toISOString(),
            attempts: entry.attempts + 1,
          })
          .eq('outbox_id', entry.outbox_id);
        succeeded++;
      } else {
        const text = await res.text();
        await admin
          .from('ledger_outbox')
          .update({
            attempts: entry.attempts + 1,
            last_attempted_at: new Date().toISOString(),
            error_message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
            status: entry.attempts >= 5 ? 'failed' : 'pending',
          })
          .eq('outbox_id', entry.outbox_id);
        failed++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from('ledger_outbox')
        .update({
          attempts: entry.attempts + 1,
          last_attempted_at: new Date().toISOString(),
          error_message: msg,
          status: entry.attempts >= 5 ? 'failed' : 'pending',
        })
        .eq('outbox_id', entry.outbox_id);
      failed++;
    }
  }

  return { processed: pendingEvents.length, succeeded, failed };
}
