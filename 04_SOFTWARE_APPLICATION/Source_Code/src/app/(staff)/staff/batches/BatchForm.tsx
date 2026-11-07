'use client';

import React, { useActionState, useState } from 'react';
import { createBatchAction, BatchActionState } from './actions';
import { SubmitButton } from '@/components/staff/SubmitButton';
import styles from './batches.module.css';

type Template = {
  template_id: string;
  template_name: string;
  benefit_value: number;
};

const initialState: BatchActionState = { success: null, error: null };

export function BatchForm({ templates }: { templates: Template[] }) {
  const [state, formAction] = useActionState(createBatchAction, initialState);

  // Mirror batchQuantity → maxRedemptions default so they stay in sync
  const [batchQty, setBatchQty] = useState(20);
  const [maxRed, setMaxRed] = useState(20);

  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10) || 1;
    setBatchQty(val);
    // Auto-sync maxRedemptions only if the user hasn't manually changed it away from batchQty
    setMaxRed((prev) => (prev === batchQty ? val : prev));
  }

  return (
    <form action={formAction} className={styles.formGrid} style={{ marginTop: 16 }}>
      {/* Error banner — shown when the server action returns an error */}
      {state.error && (
        <div
          role="alert"
          style={{
            gridColumn: '1 / -1',
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#b91c1c',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          {state.error}
        </div>
      )}

      <label>
        Voucher Template *
        <select name="templateId" required defaultValue={templates[0]?.template_id || ''}>
          {templates.length === 0 ? (
            <option value="" disabled>No active templates found — create one in Templates</option>
          ) : (
            templates.map((t, idx) => {
              const id = t.template_id || `tmpl-${idx}`;
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
          value={batchQty}
          onChange={handleQtyChange}
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
          value={maxRed}
          onChange={(e) => setMaxRed(parseInt(e.target.value, 10) || 1)}
          required
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>
          Must be ≤ batch quantity ({batchQty})
        </span>
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
        <SubmitButton
          label="Generate Batch & QRs"
          loadingLabel="Generating Batch & QR Codes…"
          style={{ minWidth: 240, height: 44, fontWeight: 700 }}
        />
      </div>
    </form>
  );
}
