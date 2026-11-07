import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTemplateAction, toggleTemplateStatusAction } from './actions';
import styles from './templates.module.css';

export const metadata = {
  title: 'Voucher Templates',
};

async function getTemplates() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('voucher_template')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1>Voucher Templates</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Define reusable discount parameters (Flow 1 from core diagrams). Only percentage vouchers are enabled in Release 1.
          </p>
        </div>
      </div>

      {/* Create Template Panel */}
      <details className="card" open>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', marginBottom: 12 }}>
          + Create New Voucher Template
        </summary>

        <form action={createTemplateAction as any} className={styles.formGrid} style={{ marginTop: 16 }}>
          <label>
            Template Name *
            <input
              name="templateName"
              type="text"
              required
              placeholder="e.g. 30-Day Focus Access Privilege"
            />
          </label>

          <label>
            Benefit Type *
            <select name="benefitType" defaultValue="PERCENTAGE">
              <option value="PERCENTAGE">Percentage Discount (Active)</option>
              <option value="FIXED_PESO" disabled>Fixed Peso Off (Disabled in v1)</option>
              <option value="FIXED_FINAL_PRICE" disabled>Fixed Final Price (Disabled in v1)</option>
              <option value="FREE_HOURS" disabled>Free Hours (Disabled in v1)</option>
            </select>
          </label>

          <label>
            Discount Value (%) *
            <input
              name="benefitValue"
              type="number"
              min="1"
              max="100"
              step="1"
              defaultValue="20"
              required
            />
          </label>

          <label>
            Effective Duration (Days) *
            <input
              name="effectiveDuration"
              type="number"
              min="1"
              max="365"
              defaultValue="30"
              required
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-muted)' }}>
              Excluded Products (Extension §6)
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                name="excludeIntensive"
                defaultChecked
                style={{ width: 'auto', minHeight: 'auto' }}
              />
              Exclude ₱420 Intensive Pass
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                name="excludeReservation"
                defaultChecked
                style={{ width: 'auto', minHeight: 'auto' }}
              />
              Exclude Hub Reservations
            </label>
          </div>

          <label className={styles.formFull}>
            Restrictions (Text Description)
            <input
              name="restrictions"
              type="text"
              placeholder="e.g. Not valid for conference room; Cannot stack with other promos"
            />
          </label>

          <label className={styles.formFull}>
            Internal Description & Campaign Notes
            <textarea
              name="description"
              rows={2}
              placeholder="Intended for partner student org events and general hub giveaways."
            />
          </label>

          <div className={styles.formFull} style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ minWidth: 200 }}>
              Save & Make Available
            </button>
          </div>
        </form>
      </details>

      {/* Templates List */}
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 16 }}>Existing Voucher Templates ({templates.length})</h2>
        {templates.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 36 }}>
            No voucher templates defined yet.
          </div>
        ) : (
          <div className={styles.grid}>
            {templates.map((tpl: any) => {
              const isInactive = tpl.status === 'Inactive';
              return (
                <div
                  key={tpl.template_id}
                  className={`${styles.templateCard} ${isInactive ? styles.templateCardInactive : ''}`}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{tpl.template_name}</h3>
                      <span className={`badge ${tpl.status === 'Active' ? 'badge-success' : 'badge-muted'}`}>
                        {tpl.status}
                      </span>
                    </div>

                    <div className={styles.badgeValue}>
                      {tpl.benefit_value}% OFF
                    </div>

                    <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '4px 0 16px' }}>
                      {tpl.description || 'No description provided.'}
                    </p>

                    <div className={styles.cardMeta}>
                      <div className={styles.cardMetaRow}>
                        <span style={{ color: 'var(--color-muted)' }}>Duration:</span>
                        <strong>{tpl.effective_duration} consecutive days</strong>
                      </div>
                      <div className={styles.cardMetaRow}>
                        <span style={{ color: 'var(--color-muted)' }}>Excluded items:</span>
                        <span>
                          {Array.isArray(tpl.excluded_products) && tpl.excluded_products.length > 0
                            ? tpl.excluded_products.join(', ')
                            : 'None'}
                        </span>
                      </div>
                      {tpl.restrictions && (
                        <div className={styles.cardMetaRow}>
                          <span style={{ color: 'var(--color-muted)' }}>Restrictions:</span>
                          <span style={{ textAlign: 'right', maxWidth: '60%' }}>{tpl.restrictions}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.actionsRow} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                    <form
                      action={async () => {
                        'use server';
                        await toggleTemplateStatusAction(tpl.template_id, tpl.status);
                      }}
                    >
                      <button
                        type="submit"
                        className={isInactive ? 'btn-primary' : 'btn'}
                        style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                      >
                        {isInactive ? 'Activate' : 'Deactivate'}
                      </button>
                    </form>
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
