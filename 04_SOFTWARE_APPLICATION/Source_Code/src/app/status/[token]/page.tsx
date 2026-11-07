import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { QRCodeGenerator } from '@/lib/qr';
import { formatDisplayPHT } from '@/lib/timezone';
import styles from './status.module.css';

export const metadata = {
  title: 'Voucher Status',
};

async function getStatusData(token: string) {
  const admin = createAdminClient();

  const { data: reg } = await admin
    .from('registration')
    .select(`
      registration_id,
      status,
      submitted_at,
      rejection_reason,
      student:student_id (
        student_name,
        student_id,
        email
      ),
      voucher_batch:batch_id (
        event_name,
        voucher_template:template_id (
          template_name,
          benefit_value
        )
      ),
      personal_voucher:personal_voucher (
        personal_voucher_id,
        personal_qr_code,
        status,
        expiry_date
      )
    `)
    .eq('status_token', token.trim())
    .single();

  if (!reg) return null;

  const pv = Array.isArray(reg.personal_voucher) ? reg.personal_voucher[0] : reg.personal_voucher;
  let qrDataUrl: string | null = null;

  if (pv && pv.personal_qr_code) {
    try {
      qrDataUrl = await QRCodeGenerator.toDataURL(pv.personal_qr_code, 220);
    } catch (err) {
      console.error('QR rendering error on status page:', err);
    }
  }

  return {
    registration: reg,
    personalVoucher: pv,
    qrDataUrl,
  };
}

export default async function StudentStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getStatusData(token);

  if (!data) {
    return (
      <div className={styles.scene}>
        <div className={styles.card}>
          <div className={styles.brand}>
            <span className={styles.brandWordmark}>SILID</span>
            <span className={styles.brandLocation}>Malolos</span>
          </div>
          <h1 className={styles.title}>Status Link Not Found</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>
            This private status link is invalid. Please ensure you copied the complete address from your registration confirmation or email.
          </p>
        </div>
      </div>
    );
  }

  const { registration: reg, personalVoucher: pv, qrDataUrl } = data;
  const student = reg.student as any;
  const batch = reg.voucher_batch as any;
  const template = batch?.voucher_template as any;

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandWordmark}>SILID</span>
          <span className={styles.brandLocation}>Malolos</span>
        </div>

        <h1 className={styles.title}>Registration Status</h1>

        {/* Status Indicator */}
        {reg.status === 'Pending' && (
          <div className={`${styles.statusBanner} ${styles.statusPending}`}>
            <strong style={{ fontSize: '1.1rem' }}>⏳ Review in Progress</strong>
            <span>
              Your registration for <strong>{template?.template_name}</strong> is currently being verified by the hub staff. You will receive an email once approved.
            </span>
          </div>
        )}

        {reg.status === 'Approved' && (
          <div className={`${styles.statusBanner} ${styles.statusApproved}`}>
            <strong style={{ fontSize: '1.1rem' }}>✓ Registration Approved!</strong>
            <span>
              Congratulations! Your <strong>{template?.benefit_value}% discount voucher</strong> has been issued.
            </span>
          </div>
        )}

        {reg.status === 'Rejected' && (
          <div className={`${styles.statusBanner} ${styles.statusRejected}`}>
            <strong style={{ fontSize: '1.1rem' }}>✕ Registration Not Approved</strong>
            <span>
              {reg.rejection_reason || 'Disapproved during staff review. Please check with SILID Malolos front desk.'}
            </span>
          </div>
        )}

        {/* Personal Voucher QR Code display if approved */}
        {reg.status === 'Approved' && pv && qrDataUrl && (
          <div className={styles.qrContainer}>
            <img
              src={qrDataUrl}
              alt="Personal Voucher QR"
              width={200}
              height={200}
              style={{ display: 'block', borderRadius: 12, background: '#ffffff', padding: 8, border: '1px solid var(--color-border)' }}
            />
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
              {pv.personal_qr_code}
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              Show this QR code at checkout when paying for your session.
            </span>
            <span className={`badge ${pv.status === 'Active' ? 'badge-success' : 'badge-muted'}`} style={{ marginTop: 4 }}>
              Status: {pv.status}
            </span>
          </div>
        )}

        {/* Details Summary */}
        <div className={styles.detailsGrid}>
          <div className={styles.detailRow}>
            <span style={{ color: 'var(--color-muted)' }}>Student:</span>
            <strong>{student?.student_name} ({student?.student_id})</strong>
          </div>
          <div className={styles.detailRow}>
            <span style={{ color: 'var(--color-muted)' }}>Event / Batch:</span>
            <span>{batch?.event_name}</span>
          </div>
          <div className={styles.detailRow}>
            <span style={{ color: 'var(--color-muted)' }}>Benefit:</span>
            <strong>{template?.benefit_value}% Percentage Discount</strong>
          </div>
          {pv && (
            <div className={styles.detailRow}>
              <span style={{ color: 'var(--color-muted)' }}>Valid Until (PHT):</span>
              <strong>{formatDisplayPHT(pv.expiry_date)}</strong>
            </div>
          )}
          <div className={styles.detailRow}>
            <span style={{ color: 'var(--color-muted)' }}>Submitted:</span>
            <span>{formatDisplayPHT(reg.submitted_at)}</span>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0 }}>
          SILID Malolos Study Hub · Data Privacy Act of 2012 Compliant
        </p>
      </div>
    </div>
  );
}
