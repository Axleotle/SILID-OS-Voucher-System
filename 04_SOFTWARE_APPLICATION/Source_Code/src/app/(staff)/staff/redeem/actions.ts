'use server';

import { createClient } from '@/lib/supabase/server';
import { redeemVoucher } from '@/lib/voucher-validator';

export async function redeemVoucherStaffAction(personalQrCode: string) {
  if (!personalQrCode || !personalQrCode.trim()) {
    return { success: false, reasonMessage: 'Please enter or scan a valid voucher QR code.' };
  }

  // Get current staff user if signed in
  let staffId: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) staffId = user.id;
  } catch (err) {
    // Local dev fallback
    staffId = 'a0000000-0000-0000-0000-000000000001';
  }

  // Calls the atomic redeem function (§4 / §6)
  const result = await redeemVoucher({
    personalQrCode: personalQrCode.trim(),
    processedByStaffId: staffId,
    source: 'staff_ui',
    actorRole: 'Staff',
  });

  return {
    success: result.success,
    reasonCode: result.reasonCode,
    reasonMessage: result.reasonMessage,
    receiptText: result.receiptText,
    redemptionId: result.redemptionId,
  };
}
