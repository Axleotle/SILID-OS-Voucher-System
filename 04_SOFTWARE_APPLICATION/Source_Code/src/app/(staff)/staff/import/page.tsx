import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { importLegacyVouchersAction } from './actions';
import { formatDisplayPHT } from '@/lib/timezone';

export const metadata = {
  title: 'Import Old Vouchers',
};

async function getLegacyImports() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('legacy_voucher')
    .select('*')
    .order('imported_at', { ascending: false })
    .limit(100);
  return data || [];
}

export default async function ImportPage() {
  const legacyRecords = await getLegacyImports();

  const unsupportedCount = legacyRecords.filter((r: any) => r.original_type === 'LEGACY_UNSUPPORTED').length;
  const percentageCount = legacyRecords.length - unsupportedCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1>Legacy Voucher Import & Reconciliation</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Import historical vouchers from CSV with flexible column mapping. Unsupported voucher types (fixed price, free hours) are preserved as read-only <code>legacy_unsupported</code> records and are never redeemable (§3).
        </p>
      </div>

      {/* Upload Form */}
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>Upload Old Vouchers CSV</h2>
        <form action={importLegacyVouchersAction as any} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'end' }}>
          <label>
            Import Batch Label *
            <input name="batchName" type="text" defaultValue={`Import-${new Date().toISOString().split('T')[0]}`} required />
          </label>

          <label>
            Select CSV File *
            <input name="file" type="file" accept=".csv" required style={{ padding: '8px' }} />
          </label>

          <button type="submit" className="btn btn-primary" style={{ height: 44 }}>
            📥 Run Import & Reconciliation
          </button>
        </form>

        <div style={{ marginTop: 16, padding: '12px 14px', background: '#f5f3ec', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--color-muted)', lineHeight: 1.5 }}>
          <strong>Flexible Column Mapping Supported:</strong> Columns matching <code>code</code>, <code>voucher_code</code>, <code>type</code>, <code>value</code>, <code>reference_value</code>, <code>notes</code>, etc., are mapped automatically.
        </div>
      </div>

      {/* Reconciliation Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="card">
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>
            Total Imported Records
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', margin: '4px 0' }}>
            {legacyRecords.length}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Historical records in DB</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-amber)', fontWeight: 700 }}>
            Legacy Unsupported (Read-only)
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-amber)', margin: '4px 0' }}>
            {unsupportedCount}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Preserved for audit; never redeemable (§3)</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-success)', fontWeight: 700 }}>
            Percentage Mapped
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-success)', margin: '4px 0' }}>
            {percentageCount}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Classified as percentage discounts</span>
        </div>
      </div>

      {/* Imported Records Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f5f2e9', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '10px 14px' }}>Original Code</th>
              <th style={{ padding: '10px 14px' }}>Classification</th>
              <th style={{ padding: '10px 14px' }}>Import Batch</th>
              <th style={{ padding: '10px 14px' }}>Imported At (PHT)</th>
              <th style={{ padding: '10px 14px' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {legacyRecords.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--color-muted)' }}>
                  No legacy vouchers imported yet.
                </td>
              </tr>
            ) : (
              legacyRecords.map((r: any, idx: number) => (
                <tr key={r.legacy_id || r.id || `legacy-${idx}`} style={{ borderBottom: '1px solid #f0eae0' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {r.original_code}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${r.original_type === 'LEGACY_UNSUPPORTED' ? 'badge-danger' : 'badge-success'}`}>
                      {r.original_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>{r.import_batch}</td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {formatDisplayPHT(r.imported_at)}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                    {r.notes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
