'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { QRCodeGenerator } from '@/lib/qr';
import { writeAuditLog } from '@/lib/audit';

export async function createBatchAction(formData: FormData) {
  const admin = createAdminClient();

  const templateId = (formData.get('templateId') as string || '').trim();
  const eventName = (formData.get('eventName') as string || '').trim();
  const eventDate = (formData.get('eventDate') as string || '').trim();
  const claimDeadline = (formData.get('claimDeadline') as string || '').trim();
  const batchQuantity = parseInt(formData.get('batchQuantity') as string || '0', 10);
  const maxRedemptions = parseInt(formData.get('maxRedemptions') as string || '0', 10);
  const codePrefix = (formData.get('codePrefix') as string || 'CT').trim();

  if (!templateId || !eventName || !eventDate || !claimDeadline) {
    return { success: false, error: 'All fields are required.' };
  }

  if (batchQuantity <= 0 || batchQuantity > 500) {
    return { success: false, error: 'Batch quantity must be between 1 and 500.' };
  }

  if (maxRedemptions <= 0 || maxRedemptions > batchQuantity) {
    return { success: false, error: 'Max redemptions must be greater than 0 and less than or equal to batch quantity.' };
  }

  if (new Date(claimDeadline) < new Date(eventDate)) {
    return { success: false, error: 'Claim deadline cannot be earlier than the event date.' };
  }

  // Threshold check (§7): large batches (> 50 tickets) require Founder or Manager role
  const BULK_THRESHOLD = 50;
  const { data: staffList } = await admin.from('staff').select('staff_id, role').limit(1);
  const creator = staffList?.[0] || { staff_id: 'a0000000-0000-0000-0000-000000000001', role: 'Staff' };

  if (batchQuantity > BULK_THRESHOLD && creator.role === 'Staff') {
    return {
      success: false,
      error: `Batches larger than ${BULK_THRESHOLD} tickets require Founder or Manager authorization (§7 Approval Thresholds).`,
    };
  }

  // 1. Create the Voucher Batch
  const { data: batch, error: batchError } = await admin
    .from('voucher_batch')
    .insert({
      template_id: templateId,
      created_by_staff_id: creator.staff_id,
      event_name: eventName,
      event_date: eventDate,
      claim_deadline: claimDeadline,
      batch_quantity: batchQuantity,
      max_redemptions: maxRedemptions,
      status: 'Active',
      code_prefix: codePrefix,
    })
    .select()
    .single();

  if (batchError || !batch) {
    return { success: false, error: batchError?.message || 'Failed to create batch.' };
  }

  // 2. Generate N Claim Tickets with unique cryptographically random codes
  const ticketsToInsert = [];
  const generatedCodes = new Set<string>();

  for (let i = 1; i <= batchQuantity; i++) {
    let claimCode = QRCodeGenerator.generateClaimCode(codePrefix, 8);
    while (generatedCodes.has(claimCode)) {
      claimCode = QRCodeGenerator.generateClaimCode(codePrefix, 8);
    }
    generatedCodes.add(claimCode);

    // QR Data encodes the claim code / public registration URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrData = `${appUrl}/register/${claimCode}`;

    ticketsToInsert.push({
      batch_id: batch.batch_id,
      claim_code: claimCode,
      qr_code_data: qrData,
      status: 'Available',
    });
  }

  const { error: ticketsError } = await admin.from('claim_ticket').insert(ticketsToInsert);

  if (ticketsError) {
    // Cleanup batch if tickets fail
    await admin.from('voucher_batch').delete().eq('batch_id', batch.batch_id);
    return { success: false, error: `Failed to generate tickets: ${ticketsError.message}` };
  }

  await writeAuditLog({
    actorStaffId: creator.staff_id,
    actorRole: creator.role,
    action: 'BATCH_GENERATED',
    entityType: 'voucher_batch',
    entityId: batch.batch_id,
    afterValue: {
      eventName,
      quantity: batchQuantity,
      maxRedemptions,
      codePrefix,
    },
  });

  revalidatePath('/staff/batches');
  return { success: true, batchId: batch.batch_id };
}
