import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import RegistrationForm from '@/components/public/RegistrationForm';
import { formatDisplayPHT } from '@/lib/timezone';
import styles from './register.module.css';

export const metadata = {
  title: 'Student Voucher Registration',
};

async function getTicketInfo(claimCode: string) {
  const admin = createAdminClient();

  const { data: ticket } = await admin
    .from('claim_ticket')
    .select(`
      claim_ticket_id,
      claim_code,
      status,
      voucher_batch:batch_id (
        batch_id,
        event_name,
        event_date,
        claim_deadline,
        status,
        voucher_template:template_id (
          template_name,
          benefit_value,
          effective_duration,
          restrictions
        )
      )
    `)
    .eq('claim_code', claimCode.trim())
    .single();

  return ticket;
}

export default async function StudentRegisterPage({
  params,
}: {
  params: Promise<{ claimCode: string }>;
}) {
  const { claimCode } = await params;
  const ticket = await getTicketInfo(claimCode);

  if (!ticket) {
    return (
      <div className={styles.scene}>
        <div className={styles.card}>
          <div className={styles.brand}>
            <span className={styles.brandWordmark}>SILID</span>
            <span className={styles.brandLocation}>Malolos</span>
          </div>
          <h1 className={styles.title}>Claim Code Not Found</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>
            The voucher claim code <code>{claimCode}</code> does not exist. Please double-check your printed ticket QR code or link.
          </p>
        </div>
      </div>
    );
  }

  const batch = ticket.voucher_batch as any;
  const template = batch?.voucher_template as any;

  // Deadline check (in PHT calendar day)
  const isDeadlinePassed = new Date(batch.claim_deadline + 'T23:59:59+08:00').getTime() < Date.now();
  const isTicketClaimed = ticket.status !== 'Available';
  const isBatchClosed = !['Active', 'Draft', 'PartiallyUsed'].includes(batch.status);

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandWordmark}>SILID</span>
          <span className={styles.brandLocation}>Malolos</span>
        </div>

        <h1 className={styles.title}>{template?.template_name || 'Student Discount Pass'}</h1>

        <div className={styles.benefitBadge}>
          {template?.benefit_value}% Discount Privilege · {template?.effective_duration} Days
        </div>

        <div className={styles.eventDetailsBox}>
          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>
              Partner Event / Campaign
            </span>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginTop: 2 }}>{batch.event_name}</strong>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>
              Claim Deadline
            </span>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginTop: 2 }}>
              {batch.claim_deadline} (PHT)
            </strong>
          </div>
        </div>

        {/* Validation Error States */}
        {isDeadlinePassed ? (
          <div className={`${styles.alertBox} ${styles.alertError}`}>
            The claim deadline for this event voucher passed on {batch.claim_deadline}. Registrations are no longer accepted.
          </div>
        ) : isTicketClaimed ? (
          <div className={`${styles.alertBox} ${styles.alertError}`}>
            This claim code (<code>{ticket.claim_code}</code>) has already been registered by a student. Each physical ticket can only be claimed once.
          </div>
        ) : isBatchClosed ? (
          <div className={`${styles.alertBox} ${styles.alertError}`}>
            This campaign has reached its capacity limit and registration is currently closed.
          </div>
        ) : (
          <RegistrationForm claimCode={ticket.claim_code} />
        )}
      </div>
    </div>
  );
}
