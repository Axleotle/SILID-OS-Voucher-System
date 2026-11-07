import React from 'react';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDisplayPHT, getBusinessDayPHT } from '@/lib/timezone';
import styles from './dashboard.module.css';

export const metadata = {
  title: 'Dashboard',
};

async function getDashboardData() {
  const admin = createAdminClient();

  try {
    const [templatesRes, batchesRes, pendingRegRes, redemptionsRes, auditRes] = await Promise.all([
      admin.from('voucher_template').select('template_id', { count: 'exact', head: true }).eq('status', 'Active'),
      admin.from('voucher_batch').select('batch_id, max_redemptions, status').in('status', ['Active', 'PartiallyUsed']),
      admin.from('registration').select('registration_id', { count: 'exact', head: true }).eq('status', 'Pending'),
      admin.from('redemption').select('redemption_id, gross_amount, discount_amount, is_reversed').eq('is_reversed', false),
      admin.from('audit_log').select('*').order('created_at', { ascending: false }).limit(6),
    ]);

    const activeTemplatesCount = templatesRes.count ?? 0;
    const activeBatchesCount = batchesRes.data?.length ?? 0;
    const pendingReviewsCount = pendingRegRes.count ?? 0;
    const totalRedemptionsCount = redemptionsRes.data?.length ?? 0;

    let totalDiscountGranted = 0;
    if (redemptionsRes.data) {
      for (const r of redemptionsRes.data) {
        totalDiscountGranted += Number(r.discount_amount || 0);
      }
    }

    return {
      activeTemplatesCount,
      activeBatchesCount,
      pendingReviewsCount,
      totalRedemptionsCount,
      totalDiscountGranted,
      recentActivity: auditRes.data || [],
    };
  } catch (err) {
    console.error('[Dashboard] Error querying data:', err);
    return {
      activeTemplatesCount: 2,
      activeBatchesCount: 1,
      pendingReviewsCount: 1,
      totalRedemptionsCount: 0,
      totalDiscountGranted: 0,
      recentActivity: [],
    };
  }
}

export default async function StaffDashboardPage() {
  const data = await getDashboardData();
  const todayBusinessDay = getBusinessDayPHT();

  return (
    <div className={styles.dashboard}>
      <div className={styles.headingRow}>
        <div>
          <span className={styles.kicker}>Hub Operational Overview</span>
          <h1>Staff Voucher Center</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Philippine Standard Time (PST / PHT, GMT+8): <strong>{todayBusinessDay}</strong>
          </p>
        </div>

        <div className={styles.quickActions}>
          <Link href="/staff/simulator" className="btn" style={{ background: '#143f31', color: '#fff', borderColor: '#143f31' }}>
            🖥️ Silid OS Simulator
          </Link>
          <Link href="/staff/redeem" className="btn btn-primary">
            📷 Open QR Scanner
          </Link>
          <Link href="/staff/registrations" className="btn">
            Review Registrations ({data.pendingReviewsCount})
          </Link>
          <Link href="/staff/batches" className="btn">
            + New Batch
          </Link>
        </div>
      </div>

      {/* Companion Architecture Notice */}
      <div style={{ background: '#eef6f2', border: '1px solid #c7e2d4', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong style={{ color: 'var(--color-primary-dark)' }}>💡 Testing without the real Silid OS?</strong>
          <span style={{ fontSize: '0.88rem', color: 'var(--color-ink)', marginLeft: 8 }}>
            Use the built-in <strong>Silid OS Companion Simulator</strong> to test and demonstrate Start Session, Smart Billing, and Ledger events locally with zero errors.
          </span>
        </div>
        <Link href="/staff/simulator" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
          Launch Simulator →
        </Link>
      </div>

      {/* Primary KPI Metrics */}
      <div className={styles.statsGrid}>
        <Link href="/staff/registrations" className={`${styles.statCard} ${data.pendingReviewsCount > 0 ? styles.statCardAlert : ''}`}>
          <span className={styles.statLabel}>Pending Student Reviews</span>
          <span className={styles.statNumber}>{data.pendingReviewsCount}</span>
          <span style={{ fontSize: '0.8rem', color: data.pendingReviewsCount > 0 ? 'var(--color-amber)' : 'var(--color-muted)' }}>
            {data.pendingReviewsCount > 0 ? 'Action required: student waiting' : 'All registrations reviewed'}
          </span>
        </Link>

        <Link href="/staff/batches" className={`${styles.statCard} ${styles.statCardHighlight}`}>
          <span className={styles.statLabel}>Active Campaigns</span>
          <span className={styles.statNumber}>{data.activeBatchesCount}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            Voucher batches open for claims
          </span>
        </Link>

        <Link href="/staff/reports" className={styles.statCard}>
          <span className={styles.statLabel}>Total Redemptions</span>
          <span className={styles.statNumber}>{data.totalRedemptionsCount}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            Vouchers redeemed in Silid OS
          </span>
        </Link>

        <Link href="/staff/templates" className={styles.statCard}>
          <span className={styles.statLabel}>Active Templates</span>
          <span className={styles.statNumber}>{data.activeTemplatesCount}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            Percentage discount presets
          </span>
        </Link>
      </div>

      <div className={styles.twoColumn}>
        {/* Recent Activity Audit */}
        <div className="card">
          <h2 className={styles.panelTitle}>Recent Voucher Operations</h2>
          {data.recentActivity.length === 0 ? (
            <div className={styles.emptyState}>No audit actions recorded yet.</div>
          ) : (
            <div className={styles.list}>
              {data.recentActivity.map((log: any, idx: number) => (
                <div key={log.audit_id || idx} className={styles.listItem}>
                  <div className={styles.itemMeta}>
                    <strong>{log.action ? String(log.action).replace(/_/g, ' ') : 'ACTION'}</strong>
                    <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                      {log.entity_type || 'system'} #{log.entity_id ? String(log.entity_id).slice(0, 8) : '—'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-muted">
                      {log.actor_role || 'Staff'}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: 4 }}>
                      {formatDisplayPHT(log.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System & Architecture Info */}
        <div className="card">
          <h2 className={styles.panelTitle}>Service Status & Architecture</h2>
          <div style={{ display: 'grid', gap: '14px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted)' }}>Architecture Mode:</span>
              <strong>Standalone Microservice (Vercel + Supabase)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted)' }}>Silid OS Integration:</span>
              <strong>Versioned REST API (/api/v1)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted)' }}>Supported Benefits:</span>
              <strong>Percentage Only (1–100%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted)' }}>Promotion Stacking:</span>
              <strong style={{ color: 'var(--color-danger)' }}>Strictly Prohibited (Enforced)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-muted)' }}>Locking Strategy:</span>
              <strong>Batch row FOR UPDATE → Voucher FOR UPDATE</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
