'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { QRCodeGenerator } from '@/lib/qr';
import { calculateExpiryDate, formatDisplayPHT } from '@/lib/timezone';
import { sendEmailWithOutbox, buildVoucherEmailHtml } from '@/lib/email';
import { writeAuditLog } from '@/lib/audit';

export async function approveRegistrationAction(registrationId: string) {
  const admin = createAdminClient();

  // 1. Fetch registration with student, batch, and template
  const { data: reg, error: fetchErr } = await admin
    .from('registration')
    .select(`
      registration_id,
      status,
      student_id,
      batch_id,
      student:student_id (
        student_id,
        student_name,
        email
      ),
      voucher_batch:batch_id (
        batch_id,
        event_name,
        voucher_template:template_id (
          template_name,
          benefit_value,
          effective_duration
        )
      )
    `)
    .eq('registration_id', registrationId)
    .single();

  if (fetchErr || !reg) {
    return { success: false, error: 'Registration record not found.' };
  }

  if (reg.status !== 'Pending') {
    return { success: false, error: `Cannot approve registration with status '${reg.status}'.` };
  }

  const student = reg.student as any;
  const batch = reg.voucher_batch as any;
  const template = batch.voucher_template as any;

  // 2. Determine reviewing staff
  const { data: staffList } = await admin.from('staff').select('staff_id').limit(1);
  const staffId = staffList?.[0]?.staff_id || 'a0000000-0000-0000-0000-000000000001';

  // 3. Generate Personal Voucher QR and Expiry Date
  const personalQrData = QRCodeGenerator.generatePersonalQrData();
  const issuedAt = new Date();
  const expiryDate = calculateExpiryDate(issuedAt, template.effective_duration);

  // 4. Update registration to Approved
  const { error: regUpdateErr } = await admin
    .from('registration')
    .update({
      status: 'Approved',
      reviewed_by_staff_id: staffId,
      reviewed_at: issuedAt.toISOString(),
    })
    .eq('registration_id', registrationId);

  if (regUpdateErr) {
    return { success: false, error: `Failed to approve registration: ${regUpdateErr.message}` };
  }

  // 5. Create Personal Voucher record (§4: Exactly one per approved registration)
  const { data: pv, error: pvErr } = await admin
    .from('personal_voucher')
    .insert({
      registration_id: registrationId,
      issued_by_staff_id: staffId,
      personal_qr_code: personalQrData,
      issued_at: issuedAt.toISOString(),
      expiry_date: expiryDate.toISOString(),
      status: 'Active',
    })
    .select()
    .single();

  if (pvErr || !pv) {
    return { success: false, error: `Failed to issue personal voucher: ${pvErr?.message}` };
  }

  // 6. Generate QR image Data URL and send email to student (§5.4)
  try {
    const qrDataUrl = await QRCodeGenerator.toDataURL(personalQrData, 220);
    const emailHtml = buildVoucherEmailHtml({
      studentName: student.student_name,
      templateName: template.template_name,
      discountPercent: template.benefit_value,
      personalQrData,
      qrDataUrl,
      expiryFormatted: formatDisplayPHT(expiryDate),
    });

    await sendEmailWithOutbox({
      toEmail: student.email,
      subject: `Your ${template.benefit_value}% SILID Voucher is Ready!`,
      htmlBody: emailHtml,
      relatedEntityType: 'personal_voucher',
      relatedEntityId: pv.personal_voucher_id,
    });
  } catch (emailErr) {
    console.error('[Approve Registration] Email dispatch error:', emailErr);
  }

  // 7. Audit log
  await writeAuditLog({
    actorStaffId: staffId,
    actorRole: 'Staff',
    action: 'REGISTRATION_APPROVED',
    entityType: 'registration',
    entityId: registrationId,
    afterValue: {
      personalVoucherId: pv.personal_voucher_id,
      personalQrCode: personalQrData,
      expiryDate: expiryDate.toISOString(),
    },
  });

  revalidatePath('/staff/registrations');
  return { success: true };
}

export async function rejectRegistrationAction(registrationId: string, rejectionReason: string) {
  const admin = createAdminClient();

  if (!rejectionReason || !rejectionReason.trim()) {
    return { success: false, error: 'A rejection reason is required (§5.4).' };
  }

  const { data: staffList } = await admin.from('staff').select('staff_id').limit(1);
  const staffId = staffList?.[0]?.staff_id || 'a0000000-0000-0000-0000-000000000001';

  // Mark Rejected. A rejected registration never gets a voucher QR (§4 appendix rule).
  const { error } = await admin
    .from('registration')
    .update({
      status: 'Rejected',
      rejection_reason: rejectionReason.trim(),
      reviewed_by_staff_id: staffId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('registration_id', registrationId)
    .eq('status', 'Pending');

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog({
    actorStaffId: staffId,
    actorRole: 'Staff',
    action: 'REGISTRATION_REJECTED',
    entityType: 'registration',
    entityId: registrationId,
    afterValue: { rejectionReason: rejectionReason.trim() },
  });

  revalidatePath('/staff/registrations');
  return { success: true };
}
