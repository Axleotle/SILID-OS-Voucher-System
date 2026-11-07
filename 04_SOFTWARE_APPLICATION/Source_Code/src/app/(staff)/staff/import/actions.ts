'use server';

import { revalidatePath } from 'next/cache';
import Papa from 'papaparse';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit';

export async function importLegacyVouchersAction(formData: FormData) {
  const admin = createAdminClient();
  const file = formData.get('file') as File | null;
  const rawBatchName = (formData.get('batchName') as string || 'Legacy-Import').trim();

  if (!file || file.size === 0) {
    return { success: false, error: 'Please choose a valid CSV file to import.' };
  }

  const csvText = await file.text();

  const parseResult = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
    return { success: false, error: `CSV parse error: ${parseResult.errors[0]?.message}` };
  }

  const rows = parseResult.data as any[];

  let supportedCount = 0;
  let legacyUnsupportedCount = 0;
  let skippedCount = 0;
  let totalReferenceValue = 0;

  const recordsToInsert = [];

  for (const row of rows) {
    // Flexible column mapping: check for common header variants
    const code = row.code || row.voucher_code || row.voucherCode || row['Voucher Code'] || row['Code'];
    const type = row.type || row.benefit_type || row.benefitType || row['Voucher Covers'] || row['Type'] || 'UNKNOWN';
    const value = parseFloat(row.value || row.benefit_value || row.reference_value || row['Reference Value (₱)'] || '0');
    const notes = row.notes || row.description || row['Campaign / Promotion'] || row['Notes'] || '';

    if (!code) {
      skippedCount++;
      continue;
    }

    // Determine type: if not percentage, mark as read-only legacy_unsupported (§3)
    const isPercentage = type.toUpperCase().includes('PERCENT') || (value > 0 && value <= 100 && type.toUpperCase().includes('%'));

    if (isPercentage) {
      supportedCount++;
    } else {
      // Out of first-release scope: preserve as read-only legacy_unsupported
      legacyUnsupportedCount++;
    }

    if (value > 0) {
      totalReferenceValue += value;
    }

    recordsToInsert.push({
      original_code: String(code).trim(),
      original_type: isPercentage ? 'PERCENTAGE' : 'LEGACY_UNSUPPORTED',
      original_data: row,
      import_batch: rawBatchName,
      notes: `${notes} [Auto-classified: ${isPercentage ? 'PERCENTAGE' : 'legacy_unsupported - Never redeemable'}]`,
    });
  }

  if (recordsToInsert.length > 0) {
    const { error: insertErr } = await admin.from('legacy_voucher').insert(recordsToInsert);
    if (insertErr) {
      return { success: false, error: `Database insert failed: ${insertErr.message}` };
    }
  }

  await writeAuditLog({
    action: 'LEGACY_VOUCHERS_IMPORTED',
    entityType: 'legacy_voucher',
    entityId: rawBatchName,
    afterValue: {
      totalRows: rows.length,
      supportedCount,
      legacyUnsupportedCount,
      skippedCount,
      totalReferenceValue,
    },
  });

  revalidatePath('/staff/import');

  return {
    success: true,
    report: {
      totalImported: recordsToInsert.length,
      supportedCount,
      legacyUnsupportedCount,
      skippedCount,
      totalReferenceValue: Math.round(totalReferenceValue * 100) / 100,
    },
  };
}
