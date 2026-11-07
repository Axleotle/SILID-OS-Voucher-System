'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEnabledStrategy } from '@/lib/pricing';
import { writeAuditLog } from '@/lib/audit';

export async function createTemplateAction(formData: FormData) {
  const admin = createAdminClient();

  const templateName = (formData.get('templateName') as string || '').trim();
  const benefitType = (formData.get('benefitType') as string || 'PERCENTAGE').trim();
  const benefitValue = parseFloat(formData.get('benefitValue') as string || '0');
  const effectiveDuration = parseInt(formData.get('effectiveDuration') as string || '0', 10);
  const restrictions = (formData.get('restrictions') as string || '').trim();
  const description = (formData.get('description') as string || '').trim();
  const excludeIntensive = formData.get('excludeIntensive') === 'on';
  const excludeReservation = formData.get('excludeReservation') === 'on';

  if (!templateName) {
    return { success: false, error: 'Template name is required.' };
  }

  // Strategy validation
  try {
    const strategy = getEnabledStrategy(benefitType);
    if (!strategy.validateBenefitValue(benefitValue)) {
      return { success: false, error: 'Benefit value must be a valid percentage between 1 and 100.' };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }

  if (effectiveDuration <= 0) {
    return { success: false, error: 'Effective duration must be at least 1 day.' };
  }

  const excludedProducts: string[] = [];
  if (excludeIntensive) excludedProducts.push('Intensive Pass');
  if (excludeReservation) excludedProducts.push('Hub Reservations');

  // Fetch or default creator staff ID (e.g. founder)
  const { data: staffList } = await admin.from('staff').select('staff_id').limit(1);
  const staffId = staffList?.[0]?.staff_id || 'a0000000-0000-0000-0000-000000000001';

  const { data: created, error } = await admin
    .from('voucher_template')
    .insert({
      created_by_staff_id: staffId,
      template_name: templateName,
      benefit_type: benefitType as any,
      benefit_value: benefitValue,
      effective_duration: effectiveDuration,
      restrictions: restrictions || null,
      excluded_products: excludedProducts,
      description: description || null,
      status: 'Active',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog({
    actorStaffId: staffId,
    actorRole: 'Staff',
    action: 'TEMPLATE_CREATED',
    entityType: 'voucher_template',
    entityId: created.template_id,
    afterValue: created,
  });

  try {
    revalidatePath('/staff/templates');
  } catch {}
  return { success: true };
}

export async function toggleTemplateStatusAction(templateId: string, currentStatus: string) {
  const admin = createAdminClient();
  const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

  const { error } = await admin
    .from('voucher_template')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('template_id', templateId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog({
    action: nextStatus === 'Active' ? 'TEMPLATE_ACTIVATED' : 'TEMPLATE_DEACTIVATED',
    entityType: 'voucher_template',
    entityId: templateId,
    afterValue: { status: nextStatus },
  });

  try {
    revalidatePath('/staff/templates');
  } catch {}
  return { success: true };
}
