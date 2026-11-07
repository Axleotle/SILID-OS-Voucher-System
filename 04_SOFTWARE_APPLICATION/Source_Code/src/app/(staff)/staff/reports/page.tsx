import React from 'react';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { reverseRedemption } from '@/lib/voucher-validator';
import { formatDisplayPHT, getBusinessDayPHT } from '@/lib/timezone';
import { ExportCsvButton } from '@/components/staff/ExportCsvButton';
import { revalidatePath } from 'next/cache';

export const metadata = {
  title: 'Reports & Reconciliations',
};

async function getReportData(batchFilter?: string) {
  const admin = createAdminClient();

  const [batchesRes, redemptionsRes] = await Promise.all([
    admin.from('voucher_batch').select('batch_id, event_name, status'),
    admin.from('redemption').select(`
      redemption_id,
      redeemed_at,
      is_reversed,
      reversal_reason,
      source,
      session_ref,
      gross_amount,
      discount_amount,
      net_amount,
      processed_by_staff_id,
      personal_voucher:personal_voucher_id (
        personal_voucher_id,
        personal_qr_code,
        status,
        registration:registration_id (
          student:student_id (
            student_name,
            student_id
          ),
          voucher_batch:batch_id (
            batch_id,
            event_name,
            voucher_template:template_id (
              template_name,
              benefit_value
            )
          )
        )
      )
    `).order('redeemed_at', { ascending: false }),
  ]);

  let items = redemptionsRes.data || [];
  if (batchFilter && batchFilter !== 'all') {
    items = items.filter((r: any) => r.personal_voucher?.registration?.voucher_batch?.batch_id === batchFilter);
  }

  return {
    batches: batchesRes.data || [],
    redemptions: items,
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; format?: string }>;
}) {
  const { batch: batchParam, format } = await searchParams;
  const { batches, redemptions } = await getReportData(batchParam);

  // Compute Totals
  const totalCount = redemptions.length;
  const activeRedemptions = redemptions.filter((r: any) => !r.is_reversed);
  const reversedCount = totalCount - activeRedemptions.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Voucher Reports & Ledger Reconciliation</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Audited redemption activity in Philippine Standard Time (PST / PHT, GMT+8). Matches Silid OS Transaction Ledger.
          </p>
        </div>

        {/* CSV Export Button */}
        <div>
          <ExportCsvButton
            headers={[
              'Redemption ID',
              'Business Day',
              'PHT Timestamp',
              'Voucher Code',
              'Student Name',
              'Campaign / Batch',
              'Status',
              'Source',
              'Session Ref',
            ]}
            rows={redemptions.map((r: any) => {
              const pv = r.personal_voucher;
              const reg = pv?.registration;
              const student = reg?.student;
              const b = reg?.voucher_batch;
              return [
                r.redemption_id,
                getBusinessDayPHT(r.redeemed_at),
                formatDisplayPHT(r.redeemed_at),
                pv?.personal_qr_code || '',
                student?.student_name || '',
                b?.event_name || '',
                r.is_reversed ? 'Reversed' : 'Valid',
                r.source,
                r.session_ref || '',
              ];
            })}
            filename={`silid_voucher_report_${getBusinessDayPHT()}.csv`}
          />
        </div>
      </div>

      {/* Filter and Summary Row */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <form method="GET" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ margin: 0 }}>
            Filter by Campaign:
            <select name="batch" defaultValue={batchParam || 'all'} style={{ minWidth: 220 }}>
              <option value="all">All Campaigns</option>
              {batches.map((b: any, idx: number) => {
                const bId = b.batch_id || b.id || `batch-${idx}`;
                return (
                  <option key={bId} value={b.batch_id || b.id}>
                    {b.event_name}
                  </option>
                );
              })}
            </select>
          </label>
          <button type="submit" className="btn" style={{ height: 44, marginTop: 18 }}>
            Apply Filter
          </button>
        </form>

        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
              Total Scans
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{totalCount}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-success)' }}>
              Active Redemptions
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>
              {activeRedemptions.length}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-danger)' }}>
              Reversals
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>
              {reversedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Redemptions Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#f5f2e9', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '12px 16px' }}>PHT Date & Time</th>
              <th style={{ padding: '12px 16px' }}>Business Day</th>
              <th style={{ padding: '12px 16px' }}>Voucher & Student</th>
              <th style={{ padding: '12px 16px' }}>Campaign</th>
              <th style={{ padding: '12px 16px' }}>Source</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-muted)' }}>
                  No redemption records found for this filter.
                </td>
              </tr>
            ) : (
              redemptions.map((r: any, idx: number) => {
                const pv = r.personal_voucher;
                const reg = pv?.registration;
                const student = reg?.student;
                const batch = reg?.voucher_batch;
                const tmpl = batch?.voucher_template;

                return (
                  <tr key={r.redemption_id || `red-${idx}`} style={{ borderBottom: '1px solid #f0eae0' }}>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      {formatDisplayPHT(r.redeemed_at)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="badge badge-muted">{getBusinessDayPHT(r.redeemed_at)}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Link href={`/staff/vouchers/${pv?.personal_voucher_id}`} style={{ fontWeight: 700 }}>
                        {pv?.personal_qr_code}
                      </Link>
                      <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                        {student?.student_name} ({student?.student_id})
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div>{batch?.event_name}</div>
                      <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                        {tmpl?.benefit_value}% discount
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <code>{r.source}</code>
                      {r.session_ref && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                          Ref: {r.session_ref}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${r.is_reversed ? 'badge-danger' : 'badge-success'}`}>
                        {r.is_reversed ? 'Reversed' : 'Redeemed'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {!r.is_reversed ? (
                        <form
                          action={async (formData: FormData) => {
                            'use server';
                            const reason = formData.get('reversalReason') as string || 'Session voided / customer requested reversal';
                            await reverseRedemption({
                              redemptionId: r.redemption_id,
                              reversedByStaffId: 'a0000000-0000-0000-0000-000000000001',
                              reversalReason: reason,
                              actorRole: 'Founder',
                            });
                            revalidatePath('/staff/reports');
                          }}
                          style={{ display: 'inline-flex', gap: 4 }}
                        >
                          <input
                            type="hidden"
                            name="reversalReason"
                            value="Voided session / Manager reversal"
                          />
                          <button
                            type="submit"
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            title="Reverses the redemption and returns voucher to Active (§6)"
                          >
                            Reverse
                          </button>
                        </form>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                          {r.reversal_reason || 'Reversed'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
