import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDisplayPHT } from '@/lib/timezone';

export const metadata = {
  title: 'Audit Trail',
};

async function getAuditLogs(actionFilter?: string) {
  const admin = createAdminClient();

  let query = admin
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (actionFilter && actionFilter !== 'all') {
    query = query.eq('action', actionFilter);
  }

  const { data } = await query;
  return data || [];
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action: actionParam } = await searchParams;
  const logs = await getAuditLogs(actionParam);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>System Audit Trail</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Tamper-evident logs of every voucher issuance, redemption, reversal, and template modification with anomaly flags (§7).
          </p>
        </div>

        {/* Action Filter */}
        <form method="GET" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select name="action" defaultValue={actionParam || 'all'} style={{ minWidth: 200 }}>
            <option value="all">All Actions</option>
            <option value="VOUCHER_REDEEMED">Voucher Redeemed</option>
            <option value="REGISTRATION_APPROVED">Registration Approved</option>
            <option value="REGISTRATION_REJECTED">Registration Rejected</option>
            <option value="REDEMPTION_REVERSED">Redemption Reversed</option>
            <option value="BATCH_GENERATED">Batch Generated</option>
            <option value="TEMPLATE_CREATED">Template Created</option>
          </select>
          <button type="submit" className="btn">
            Filter
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f5f2e9', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '12px 16px' }}>Timestamp (PHT)</th>
              <th style={{ padding: '12px 16px' }}>Action</th>
              <th style={{ padding: '12px 16px' }}>Target Entity</th>
              <th style={{ padding: '12px 16px' }}>Actor</th>
              <th style={{ padding: '12px 16px' }}>Anomaly Flags</th>
              <th style={{ padding: '12px 16px' }}>Details / Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-muted)' }}>
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log: any, idx: number) => {
                const hasAnomaly = Array.isArray(log.anomaly_flags) && log.anomaly_flags.length > 0;
                return (
                  <tr key={log.audit_id || log.id || `audit-${idx}`} style={{ borderBottom: '1px solid #f0eae0' }}>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      {formatDisplayPHT(log.created_at)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <strong>{log.action}</strong>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <code>{log.entity_type}</code>
                      <div style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>
                        #{log.entity_id?.slice(0, 10)}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="badge badge-muted">
                        {log.actor_role || 'System / API'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {hasAnomaly ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {log.anomaly_flags.map((flag: string) => (
                            <span key={flag} className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                              ⚠️ {flag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--color-muted)', maxWidth: 260 }}>
                      {log.reason || (log.after_value ? JSON.stringify(log.after_value).slice(0, 60) + '…' : '—')}
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
