'use client';

import React, { useState, useRef } from 'react';
import { redeemVoucherStaffAction } from './actions';
import styles from './redeem.module.css';

export default function StaffRedeemPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    reasonCode?: string;
    reasonMessage?: string;
    receiptText?: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  async function handleRedeem(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setResult(null);

    const res = await redeemVoucherStaffAction(code);
    setResult(res);
    setLoading(false);

    if (res.success) {
      setCode('');
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }

  return (
    <div className={styles.container}>
      <div>
        <h1>Staff Voucher Checkout</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Flow 5 from core diagrams: Scan the student's personal voucher QR code with a barcode/QR reader or camera, or type the PV- code.
        </p>
      </div>

      <div className={styles.scannerCard}>
        {/* Visual Scanner Viewport */}
        <div className={styles.cameraArea}>
          <span style={{ fontSize: '3rem' }}>📷</span>
          <strong>QR Scanner Active</strong>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem', maxWidth: 380 }}>
            Position the student's personal voucher QR in front of the terminal camera or connect a handheld 2D USB/Bluetooth barcode scanner.
          </span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleRedeem} className={styles.inputGroup}>
          <label>
            Personal Voucher QR Code / Data
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. PV-4F8A9B2C1D0E..."
              autoFocus
              autoComplete="off"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.1rem',
                padding: '12px 16px',
                letterSpacing: '0.05em',
              }}
            />
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !code.trim()}
            style={{ minHeight: 52, fontSize: '1rem', fontWeight: 700 }}
          >
            {loading ? 'Verifying & Locking Voucher…' : 'Redeem Voucher (Atomic)'}
          </button>
        </form>

        {/* Outcome Display */}
        {result && (
          <div
            className={`${styles.resultBox} ${
              result.success ? styles.resultSuccess : styles.resultError
            }`}
            role="alert"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>{result.success ? '✓' : '✕'}</span>
              <strong style={{ fontSize: '1.05rem' }}>
                {result.success ? 'Voucher Successfully Redeemed!' : 'Redemption Disapproved'}
              </strong>
            </div>

            <p style={{ margin: 0 }}>
              {result.reasonMessage || (result.success ? 'Discount applied to transaction.' : 'Unknown rejection')}
            </p>

            {result.receiptText && (
              <div className={styles.receiptSnippet}>
                <strong>Silid OS Receipt Line:</strong>
                <br />
                {result.receiptText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Lookup Link */}
      <div className="card" style={{ fontSize: '0.88rem', color: 'var(--color-muted)' }}>
        <strong>Staff Verification Tip:</strong> Vouchers can only be redeemed once. If a session is cancelled or voided in Silid OS, a manager can reverse the redemption in the Reports tab to reactivate the voucher.
      </div>
    </div>
  );
}
