import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit';

/**
 * Scheduled job to expire active vouchers whose expiry_date has passed.
 * Also queues EXPIRED events into ledger_outbox for Silid OS ledger reconciliation.
 */
export async function runExpireVouchersJob() {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Find all active vouchers that have reached their expiry_date
  const { data: expiredVouchers, error: selectError } = await admin
    .from('personal_voucher')
    .select('personal_voucher_id, personal_qr_code, expiry_date')
    .eq('status', 'Active')
    .lt('expiry_date', nowIso);

  if (selectError) {
    console.error('[ExpireVouchersJob] Failed to query expired vouchers:', selectError);
    return { success: false, error: selectError.message };
  }

  if (!expiredVouchers || expiredVouchers.length === 0) {
    return { success: true, count: 0 };
  }

  const idsToExpire = expiredVouchers.map((v: any) => v.personal_voucher_id);

  // Update status to Expired
  const { error: updateError } = await admin
    .from('personal_voucher')
    .update({ status: 'Expired' })
    .in('personal_voucher_id', idsToExpire);

  if (updateError) {
    console.error('[ExpireVouchersJob] Failed to update expired vouchers:', updateError);
    return { success: false, error: updateError.message };
  }

  // Queue ledger events into ledger_outbox
  const outboxEntries = expiredVouchers.map((v: any) => ({
    event_type: 'VOUCHER_EXPIRED',
    payload: {
      personal_voucher_id: v.personal_voucher_id,
      personal_qr_code: v.personal_qr_code,
      expiry_date: v.expiry_date,
      timestamp: nowIso,
    },
    status: 'pending',
  }));

  await admin.from('ledger_outbox').insert(outboxEntries);

  await writeAuditLog({
    action: 'VOUCHERS_EXPIRED_JOB',
    entityType: 'personal_voucher',
    entityId: `${idsToExpire.length}_vouchers`,
    afterValue: { expiredCount: idsToExpire.length, voucherIds: idsToExpire },
  });

  console.log(`[ExpireVouchersJob] Successfully expired ${idsToExpire.length} vouchers.`);
  return { success: true, count: idsToExpire.length };
}
