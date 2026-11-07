import React from 'react';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDisplayPHT } from '@/lib/timezone';

export const metadata = {
  title: 'Voucher Details',
};

export default async function VoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: voucher } = await admin
    .from('personal_voucher')
    .select(`
      personal_voucher_id,
      personal_qr_code,
      status,
      issued_at,
      expiry_date,
      registration:registration_id (
        registration_id,
        submitted_at,
        student:student_id (
          student_id,
          student_name,
          email,
          mobile_number
        ),
        voucher_batch:batch_id (
          event_name,
          event_date,
          claim_deadline,
          voucher_template:template_id (
            template_name,
            benefit_value,
            restrictions,
            excluded_products
          )
        )
      ),
      redemption:redemption (
        redemption_id,
        redeemed_at,
        is_reversed,
        reversal_reason,
        source,
        session_ref,
        gross_amount,
        discount_amount,
        net_amount
      )
    `)
    .eq('personal_voucher_id', id)
    .single();

  if (!voucher) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h2>Voucher Record Not Found</h2>
        <p style={{ color: 'var(--color-muted)' }}>No personal voucher exists with ID: {id}</p>
        <Link href="/staff" className="btn btn-primary" style={{ marginTop: 12 }}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const reg = voucher.registration as any;
  const student = reg?.student as any;
  const batch = reg?.voucher_batch as any;
  const template = batch?.voucher_template as any;
  const redemptions = Array.isArray(voucher.redemption) ? voucher.redemption : (voucher.redemption ? [voucher.redemption] : []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', fontWeight: 700 }}>
            Personal Voucher Record
          </span>
          <h1 style={{ margin: '4px 0' }}>{template?.template_name}</h1>
          <code style={{ fontSize: '1rem', color: 'var(--color-primary)', fontWeight: 700 }}>
            {voucher.personal_qr_code}
          </code>
        </div>
        <span
          className={`badge ${
            voucher.status === 'Active'
              ? 'badge-success'
              : voucher.status === 'Redeemed'
              ? 'badge-muted'
              : 'badge-danger'
          }`}
          style={{ fontSize: '0.9rem', padding: '6px 16px' }}
        >
          {voucher.status}
        </span>
      </div>

      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <h2 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--color-border)', paddingBottom: 8, margin: 0 }}>
          Beneficiary Student Details
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: '0.9rem' }}>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Full Name:</span>
            <strong>{student?.student_name}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Student ID:</span>
            <strong>{student?.student_id}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Email:</span>
            <strong>{student?.email}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Mobile:</span>
            <strong>{student?.mobile_number || 'N/A'}</strong>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <h2 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--color-border)', paddingBottom: 8, margin: 0 }}>
          Voucher Parameters & Validity
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: '0.9rem' }}>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Benefit:</span>
            <strong>{template?.benefit_value}% Discount</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Campaign / Event:</span>
            <strong>{batch?.event_name}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Issued At:</span>
            <span>{formatDisplayPHT(voucher.issued_at)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-muted)', display: 'block' }}>Expiry Date (PHT):</span>
            <strong>{formatDisplayPHT(voucher.expiry_date)}</strong>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <h2 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--color-border)', paddingBottom: 8, margin: 0 }}>
          Redemption History ({redemptions.length})
        </h2>
        {redemptions.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>Voucher has not been redeemed yet.</p>
        ) : (
          redemptions.map((red: any) => (
            <div
              key={red.redemption_id}
              style={{
                padding: 14,
                borderRadius: 'var(--radius-md)',
                background: red.is_reversed ? '#fcf9f9' : '#f5faf7',
                border: `1px solid ${red.is_reversed ? 'var(--color-danger-border)' : '#c3e2d1'}`,
                display: 'grid',
                gap: 6,
                fontSize: '0.88rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>
                  {red.is_reversed ? '⚠️ Reversed Redemption' : '✓ Successful Redemption'}
                </strong>
                <span>{formatDisplayPHT(red.redeemed_at)}</span>
              </div>
              <div>Source: <code>{red.source}</code> · Session Ref: <code>{red.session_ref || 'N/A'}</code></div>
              {red.is_reversed && (
                <div style={{ color: 'var(--color-danger)' }}>
                  Reversal Reason: {red.reversal_reason || 'Reversed by staff'}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/staff/reports" className="btn">
          Back to Reports
        </Link>
        <Link href="/staff/redeem" className="btn btn-primary">
          Redeem Another Voucher
        </Link>
      </div>
    </div>
  );
}
