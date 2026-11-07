import React from 'react';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveRegistrationAction, rejectRegistrationAction } from './actions';
import { formatDisplayPHT } from '@/lib/timezone';
import styles from './registrations.module.css';

export const metadata = {
  title: 'Student Registrations Review',
};

async function getRegistrations(statusFilter?: string) {
  const admin = createAdminClient();

  let query = admin
    .from('registration')
    .select(`
      registration_id,
      status,
      submitted_at,
      rejection_reason,
      status_token,
      student:student_id (
        student_id,
        student_name,
        email,
        mobile_number
      ),
      voucher_batch:batch_id (
        event_name,
        voucher_template:template_id (
          template_name,
          benefit_value
        )
      ),
      claim_ticket:claim_ticket_id (
        claim_code
      ),
      personal_voucher:personal_voucher(personal_voucher_id, personal_qr_code, status)
    `)
    .order('submitted_at', { ascending: false });

  if (statusFilter && ['Pending', 'Approved', 'Rejected'].includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  const { data } = await query;
  return data || [];
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus } = await searchParams;
  const currentFilter = filterStatus || 'Pending';
  const registrations = await getRegistrations(currentFilter === 'All' ? undefined : currentFilter);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1>Registration Review & Voucher Issuance</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Flow 4 from diagrams: Review submitted claim-ticket registrations. On approval, a personal discount QR is issued and emailed to the student.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        <Link
          href="/staff/registrations?status=Pending"
          className={`${styles.filterTab} ${currentFilter === 'Pending' ? styles.filterTabActive : ''}`}
        >
          Pending Review
        </Link>
        <Link
          href="/staff/registrations?status=Approved"
          className={`${styles.filterTab} ${currentFilter === 'Approved' ? styles.filterTabActive : ''}`}
        >
          Approved
        </Link>
        <Link
          href="/staff/registrations?status=Rejected"
          className={`${styles.filterTab} ${currentFilter === 'Rejected' ? styles.filterTabActive : ''}`}
        >
          Rejected
        </Link>
        <Link
          href="/staff/registrations?status=All"
          className={`${styles.filterTab} ${currentFilter === 'All' ? styles.filterTabActive : ''}`}
        >
          All Registrations
        </Link>
      </div>

      {/* Registrations List */}
      <div className={styles.list}>
        {registrations.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 36 }}>
            No registrations found under status '{currentFilter}'.
          </div>
        ) : (
          registrations.map((reg: any, idx: number) => {
            const student = reg.student;
            const batch = reg.voucher_batch;
            const template = batch?.voucher_template;
            const ticket = reg.claim_ticket;
            const pv = Array.isArray(reg.personal_voucher) ? reg.personal_voucher[0] : reg.personal_voucher;

            return (
              <div key={reg.registration_id || reg.id || `reg-${idx}`} className={styles.cardRow}>
                <div className={styles.studentInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '1.05rem' }}>{student?.student_name}</strong>
                    <span
                      className={`badge ${
                        reg.status === 'Approved'
                          ? 'badge-success'
                          : reg.status === 'Pending'
                          ? 'badge-pending'
                          : 'badge-danger'
                      }`}
                    >
                      {reg.status}
                    </span>
                  </div>
                  <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                    Student ID: <strong>{student?.student_id}</strong> · {student?.email}
                  </span>
                  {student?.mobile_number && (
                    <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                      Mobile: {student.mobile_number}
                    </span>
                  )}
                </div>

                <div className={styles.batchInfo}>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Event: </span>
                    <strong>{batch?.event_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Voucher: </span>
                    <span>
                      {template?.template_name} (<strong>{template?.benefit_value}% OFF</strong>)
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Claim Code: </span>
                    <code>{ticket?.claim_code}</code>
                  </div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                    Submitted: {formatDisplayPHT(reg.submitted_at)}
                  </div>
                </div>

                {/* Actions / Details */}
                <div className={styles.actions}>
                  {reg.status === 'Pending' && (
                    <>
                      <form
                        action={async () => {
                          'use server';
                          await approveRegistrationAction(reg.registration_id);
                        }}
                      >
                        <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px' }}>
                          ✓ Approve & Issue QR
                        </button>
                      </form>

                      {/* Rejection Form */}
                      <form
                        action={async (formData: FormData) => {
                          'use server';
                          const reason = formData.get('rejectionReason') as string;
                          await rejectRegistrationAction(reg.registration_id, reason);
                        }}
                        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                      >
                        <input
                          name="rejectionReason"
                          type="text"
                          required
                          placeholder="Rejection reason…"
                          style={{ width: 180, padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                        <button type="submit" className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                          Reject
                        </button>
                      </form>
                    </>
                  )}

                  {reg.status === 'Approved' && pv && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block' }}>
                        Personal QR Issued:
                      </span>
                      <code style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {pv.personal_qr_code}
                      </code>
                      <span className={`badge ${pv.status === 'Active' ? 'badge-success' : 'badge-muted'}`} style={{ marginTop: 4, display: 'inline-block' }}>
                        Voucher {pv.status}
                      </span>
                    </div>
                  )}

                  {reg.status === 'Rejected' && (
                    <div style={{ textAlign: 'right', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                      <strong>Reason:</strong> {reg.rejection_reason || 'Disapproved'}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
