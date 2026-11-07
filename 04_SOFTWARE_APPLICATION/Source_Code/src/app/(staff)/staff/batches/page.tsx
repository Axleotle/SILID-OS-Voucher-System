import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createBatchAction } from './actions';
import { QRCodeGenerator } from '@/lib/qr';
import { PrintButton } from '@/components/staff/PrintButton';
import styles from './batches.module.css';

export const metadata = {
  title: 'Batches & Claim Tickets',
};

async function getBatchesAndTemplates(selectedBatchId?: string) {
  const admin = createAdminClient();

  const [templatesRes, batchesRes] = await Promise.all([
    admin.from('voucher_template').select('template_id, template_name, benefit_value').eq('status', 'Active'),
    admin.from('voucher_batch').select(`
      batch_id,
      event_name,
      event_date,
      claim_deadline,
      batch_quantity,
      max_redemptions,
      status,
      code_prefix,
      voucher_template:template_id (
        template_name,
        benefit_value
      )
    `).order('created_at', { ascending: false }),
  ]);

  let selectedTickets: any[] = [];
  if (selectedBatchId) {
    const { data: tickets } = await admin
      .from('claim_ticket')
      .select('*')
      .eq('batch_id', selectedBatchId)
      .order('claim_code', { ascending: true })
      .limit(50); // Preview limit

    if (tickets) {
      // Pre-render QR Data URLs for preview
      selectedTickets = await Promise.all(
        tickets.map(async (t: any) => ({
          ...t,
          qrDataUrl: await QRCodeGenerator.toDataURL(t.qr_code_data, 160),
        }))
      );
    }
  }

  const rawBatches = batchesRes.data || [];
  const enrichedBatches = await Promise.all(
    rawBatches.map(async (b: any) => {
      let tmpl = b.voucher_template;
      if (!tmpl && b.template_id) {
        const { data: t } = await admin.from('voucher_template').select('template_name, benefit_value').eq('template_id', b.template_id).maybeSingle();
        tmpl = t;
      }
      return {
        ...b,
        voucher_template: tmpl,
      };
    })
  );

  return {
    templates: templatesRes.data || [],
    batches: enrichedBatches,
    selectedTickets,
  };
}

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ viewBatch?: string }>;
}) {
  const { viewBatch } = await searchParams;
  const { templates, batches, selectedTickets } = await getBatchesAndTemplates(viewBatch);

  const selectedBatch = batches.find((b: any) => b.batch_id === viewBatch);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1>Voucher Batches & Claim Tickets</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Generate printed claim cards for partner events (Flow 2 from diagrams). Students scan tickets to register.
          </p>
        </div>
      </div>

      {/* Generate Batch Form */}
      <details className="card" open={batches.length === 0}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', marginBottom: 12 }}>
          + Generate New Voucher Batch
        </summary>

        <form action={createBatchAction as any} className={styles.formGrid} style={{ marginTop: 16 }}>
          <label>
            Voucher Template *
            <select name="templateId" required defaultValue={templates[0]?.template_id || ''}>
              {templates.length === 0 ? (
                <option value="" disabled>No active templates found — create one in Templates</option>
              ) : (
                templates.map((t: any, idx: number) => {
                  const id = t.template_id || t.id || `tmpl-${idx}`;
                  return (
                    <option key={id} value={id}>
                      {t.template_name} ({t.benefit_value}% off)
                    </option>
                  );
                })
              )}
            </select>
          </label>

          <label>
            Event / Campaign Name *
            <input
              name="eventName"
              type="text"
              required
              placeholder="e.g. Youth on the Rock Malolos Summit 2026"
            />
          </label>

          <label>
            Event Date *
            <input
              name="eventDate"
              type="date"
              required
              defaultValue={new Date().toISOString().split('T')[0]}
            />
          </label>

          <label>
            Claim Deadline *
            <input
              name="claimDeadline"
              type="date"
              required
              defaultValue={new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]}
            />
          </label>

          <label>
            Batch Quantity (Tickets to print) *
            <input
              name="batchQuantity"
              type="number"
              min="1"
              max="500"
              defaultValue="20"
              required
            />
          </label>

          <label>
            Max Redemptions (Batch-wide Cap) *
            <input
              name="maxRedemptions"
              type="number"
              min="1"
              max="500"
              defaultValue="20"
              required
            />
          </label>

          <label>
            Code Prefix (Optional)
            <input
              name="codePrefix"
              type="text"
              defaultValue="CT-YTR"
              placeholder="e.g. CT-YTR"
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ minWidth: 200 }}>
              Generate Batch & QRs
            </button>
          </div>
        </form>
      </details>

      {/* Ticket QR Cards Preview & Print Sheet (if a batch is selected) */}
      {selectedBatch && (
        <div className="card printArea" style={{ background: '#fdfbf7', border: '2px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span className="badge badge-success" style={{ marginBottom: 4 }}>
                Batch Preview & Print View
              </span>
              <h2 style={{ margin: 0 }}>{selectedBatch.event_name}</h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem', margin: 0 }}>
                Showing {selectedTickets.length} of {selectedBatch.batch_quantity} claim tickets
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/staff/batches" className="btn">
                Close Preview
              </a>
              <PrintButton />
            </div>
          </div>

          <div className={styles.ticketGrid}>
            {selectedTickets.map((ticket: any, idx: number) => (
              <div key={ticket.claim_ticket_id || ticket.id || `t-${idx}`} className={styles.ticketCard}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em' }}>
                  SILID MALOLOS
                </div>
                <img
                  src={ticket.qrDataUrl}
                  alt={`QR for ${ticket.claim_code}`}
                  width={140}
                  height={140}
                  style={{ display: 'block', borderRadius: 8 }}
                />
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', letterSpacing: '0.08em' }}>
                  {ticket.claim_code}
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                  Scan to register · Claim by {selectedBatch.claim_deadline}
                </span>
                <span className={`badge ${ticket.status === 'Available' ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: '0.68rem' }}>
                  {ticket.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batches Table */}
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 16 }}>Campaign Batches ({batches.length})</h2>
        {batches.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 36 }}>
            No voucher batches generated yet. Use the form above to create your first campaign.
          </div>
        ) : (
          <div className={styles.batchesList}>
            {batches.map((b: any, idx: number) => {
              const tmpl = b.voucher_template;
              return (
                <div key={b.batch_id || b.id || `batch-${idx}`} className={styles.batchRow}>
                  <div className={styles.batchInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: '1.1rem' }}>{b.event_name}</strong>
                      <span className={`badge ${b.status === 'Active' ? 'badge-success' : 'badge-muted'}`}>
                        {b.status}
                      </span>
                    </div>
                    <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                      {tmpl?.template_name} ({tmpl?.benefit_value}% off) · Event: {b.event_date}
                    </span>
                  </div>

                  <div className={styles.batchStats}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                        Tickets
                      </span>
                      <strong>{b.batch_quantity}</strong>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                        Redemption Cap
                      </span>
                      <strong>{b.max_redemptions}</strong>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                        Claim Deadline
                      </span>
                      <strong>{b.claim_deadline}</strong>
                    </div>
                  </div>

                  <div>
                    <a
                      href={`/staff/batches?viewBatch=${b.batch_id}`}
                      className="btn"
                      style={{ fontSize: '0.85rem' }}
                    >
                      View & Print Tickets
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
