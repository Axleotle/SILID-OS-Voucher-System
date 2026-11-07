import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import SimulatorClient from './SimulatorClient';

export const metadata = {
  title: 'Silid OS Companion Simulator',
};

export default async function SimulatorPage() {
  const admin = createAdminClient();

  // Query up to 10 active vouchers to give the tester instant test options
  const { data: vouchers } = await admin
    .from('personal_voucher')
    .select('personal_voucher_id, personal_qr_code, status, expiry_date')
    .eq('status', 'Active')
    .limit(10);

  return (
    <SimulatorClient
      availableVouchers={vouchers || []}
    />
  );
}
