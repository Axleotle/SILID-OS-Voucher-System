'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit';

export async function toggleFeatureFlagAction(flagKey: string, isEnabled: boolean) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('feature_flag')
    .update({
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('flag_key', flagKey);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog({
    action: 'FEATURE_FLAG_TOGGLED',
    entityType: 'feature_flag',
    entityId: flagKey,
    afterValue: { flagKey, isEnabled },
  });

  revalidatePath('/staff/admin');
  return { success: true };
}

export async function createApiKeyAction(formData: FormData): Promise<void> {
  const admin = createAdminClient();
  const keyName = (formData.get('keyName') as string || '').trim();
  const rateLimit = parseInt(formData.get('rateLimit') as string || '60', 10);

  if (!keyName) {
    return;
  }

  // Generate a cryptographically secure random API key
  const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { data: staffList } = await admin.from('staff').select('staff_id').limit(1);
  const staffId = staffList?.[0]?.staff_id || 'a0000000-0000-0000-0000-000000000001';

  const { error } = await admin.from('api_key').insert({
    key_name: keyName,
    key_hash: keyHash,
    created_by_staff_id: staffId,
    is_active: true,
    rate_limit_per_minute: rateLimit,
  });

  if (error) {
    console.error('Failed to create API key:', error);
    return;
  }

  await writeAuditLog({
    action: 'API_KEY_CREATED',
    entityType: 'api_key',
    entityId: keyName,
    afterValue: { keyName, rateLimit },
  });

  revalidatePath('/staff/admin');
}

export async function revokeApiKeyAction(apiKeyId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('api_key')
    .update({ is_active: false })
    .eq('api_key_id', apiKeyId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog({
    action: 'API_KEY_REVOKED',
    entityType: 'api_key',
    entityId: apiKeyId,
  });

  revalidatePath('/staff/admin');
  return { success: true };
}
