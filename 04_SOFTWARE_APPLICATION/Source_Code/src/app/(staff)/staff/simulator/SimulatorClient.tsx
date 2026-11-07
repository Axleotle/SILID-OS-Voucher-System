'use client';

import React, { useState } from 'react';
import styles from './simulator.module.css';

interface LineItem {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  product_code?: string;
  description?: string;
  price?: number;
}

interface SimulatorClientProps {
  availableVouchers: Array<{
    personal_voucher_id: string;
    personal_qr_code: string;
    status: string;
    expiry_date: string;
  }>;
}

const AVAILABLE_PRODUCTS: LineItem[] = [
  { productCode: 'PASS_3HR', productName: '3-Hour Open Desk Pass', quantity: 1, unitPrice: 180, product_code: 'PASS_3HR', description: '3-Hour Open Desk Pass', price: 180 },
  { productCode: 'PASS_WHOLE_DAY', productName: 'Whole Day Study Pass', quantity: 1, unitPrice: 350, product_code: 'PASS_WHOLE_DAY', description: 'Whole Day Study Pass', price: 350 },
  { productCode: 'SNACK_COFFEE', productName: 'Brewed Hot Americano', quantity: 1, unitPrice: 120, product_code: 'SNACK_COFFEE', description: 'Brewed Hot Americano', price: 120 },
  { productCode: 'PASS_INTENSIVE', productName: 'Intensive Pass (Excluded Product)', quantity: 1, unitPrice: 500, product_code: 'PASS_INTENSIVE', description: 'Intensive Pass (Excluded Product)', price: 500 },
  { productCode: 'HUB_RESERVATION', productName: 'Private Hub Reservation (Excluded)', quantity: 1, unitPrice: 1000, product_code: 'HUB_RESERVATION', description: 'Private Hub Reservation (Excluded)', price: 1000 },
];

export default function SimulatorClient({ availableVouchers }: SimulatorClientProps) {
  const [activeTab, setActiveTab] = useState<'start' | 'active' | 'checkout' | 'ledger' | 'offline'>('start');

  // Form State
  const [memberRef, setMemberRef] = useState('MEM-001');
  const [sessionRef, setSessionRef] = useState('SESS-1001');
  const [voucherCode, setVoucherCode] = useState(availableVouchers[0]?.personal_qr_code || 'PV-DEMO-SEED-001');
  const [hasOtherPromos, setHasOtherPromos] = useState(false);
  const [selectedProductCodes, setSelectedProductCodes] = useState<string[]>(['PASS_3HR', 'SNACK_COFFEE']);

  // Response & Receipt States
  const [loading, setLoading] = useState(false);
  const [lastEndpoint, setLastEndpoint] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [heldSessions, setHeldSessions] = useState<Array<{ sessionRef: string; voucherCode: string; heldAt: string }>>([]);
  const [ledgerEvents, setLedgerEvents] = useState<any[]>([]);

  // Calculate cart total
  const cartItems = AVAILABLE_PRODUCTS.filter((p) => selectedProductCodes.includes(p.productCode));
  const grossAmount = cartItems.reduce((sum, item) => sum + item.unitPrice, 0);

  // Toggle products
  function toggleProduct(code: string) {
    if (selectedProductCodes.includes(code)) {
      setSelectedProductCodes(selectedProductCodes.filter((c) => c !== code));
    } else {
      setSelectedProductCodes([...selectedProductCodes, code]);
    }
  }

  // Generic API Helper targeting internal v1 endpoints with Simulator Auth Header
  async function callApi(endpoint: string, method: string, body?: any) {
    setLoading(true);
    setLastEndpoint(endpoint);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Silid-Simulator': 'true',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      setLastResponse({ status: res.status, ok: res.ok, data });
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      setLastResponse({ status: 500, ok: false, error: err.message });
      return { ok: false, status: 500, data: null };
    } finally {
      setLoading(false);
    }
  }

  // 1. Validate Voucher
  async function handleValidate() {
    setReceiptData(null);
    await callApi('/api/v1/vouchers/validate', 'POST', {
      personal_qr_code: voucherCode.trim(),
      member_ref: memberRef.trim(),
      session_ref: sessionRef.trim(),
      line_items: cartItems,
      has_other_promotions: hasOtherPromos,
      gross_amount: grossAmount,
    });
  }

  // 2. Start Session & Hold
  async function handleHold() {
    const res = await callApi('/api/v1/vouchers/hold', 'POST', {
      personal_qr_code: voucherCode.trim(),
      member_ref: memberRef.trim(),
      session_ref: sessionRef.trim(),
      gross_amount: grossAmount,
      line_items: cartItems,
      has_other_promotions: hasOtherPromos,
    });

    if (res.ok) {
      setHeldSessions((prev) => [
        { sessionRef, voucherCode: voucherCode.trim(), heldAt: new Date().toLocaleTimeString() },
        ...prev,
      ]);
    }
  }

  // 3. Release Session
  async function handleRelease(targetSession: string, targetVoucher: string) {
    const res = await callApi('/api/v1/vouchers/release', 'POST', {
      personal_qr_code: targetVoucher,
      session_ref: targetSession,
      reason: 'Session voided in Silid OS Simulator',
    });

    if (res.ok) {
      setHeldSessions((prev) => prev.filter((s) => s.sessionRef !== targetSession));
    }
  }

  // 4. Checkout & Redeem
  async function handleRedeem() {
    const res = await callApi('/api/v1/vouchers/redeem', 'POST', {
      personal_qr_code: voucherCode.trim(),
      source: 'silid_os',
      session_ref: sessionRef.trim(),
      gross_amount: grossAmount,
      line_items: cartItems,
      has_other_promotions: hasOtherPromos,
      idempotency_key: `idemp_${sessionRef}_${Date.now()}`,
    });

    if (res.ok) {
      setReceiptData({
        sessionRef,
        voucherCode: voucherCode.trim(),
        cartItems,
        grossAmount,
        discountAmount: res.data?.discount_result?.discountAmount ?? (grossAmount * 0.2),
        netAmount: res.data?.discount_result?.netAmount ?? (grossAmount * 0.8),
        discountPercent: res.data?.discount_result?.discountPercent ?? 20,
        redeemedAt: new Date().toLocaleString(),
        receiptText: res.data?.receipt_text,
      });
      // Remove from held sessions if it was held
      setHeldSessions((prev) => prev.filter((s) => s.sessionRef !== sessionRef));
    }
  }

  // 5. Pull Ledger
  async function handlePullLedger() {
    const res = await callApi('/api/v1/ledger/pull?limit=15', 'GET');
    if (res.ok && res.data?.events) {
      setLedgerEvents(res.data.events);
    }
  }

  // 6. Reverse Redemption
  async function handleReverse() {
    await callApi('/api/v1/vouchers/reverse', 'POST', {
      personal_qr_code: voucherCode.trim(),
      session_ref: sessionRef.trim(),
      reason: 'Customer cancelled study session via Silid OS Simulator',
    });
  }

  // 7. Offline Sync
  async function handleOfflineSync() {
    await callApi('/api/v1/vouchers/offline-sync', 'POST', {
      redemptions: [
        {
          personal_qr_code: voucherCode.trim(),
          source: 'silid_os_offline',
          session_ref: `OFFLINE-${Date.now().toString().slice(-4)}`,
          gross_amount: 180,
          discount_amount: 36,
          net_amount: 144,
          redeemed_at: new Date().toISOString(),
          idempotency_key: `offline_key_${Date.now()}`,
        },
      ],
    });
  }

  return (
    <div className={styles.container}>
      {/* Top Banner Explaining the Dual Modes */}
      <div className={styles.banner}>
        <div className={styles.bannerContent}>
          <h1>Silid OS Companion Simulator</h1>
          <p>
            <strong>Local Demonstration Mode:</strong> This console simulates the client&apos;s existing main system
            (Silid OS) so you can test all API integration points (Start Session, Active Sessions, Checkout Billing, and
            Transaction Ledger) without having the client&apos;s proprietary Silid OS project installed locally.
          </p>
        </div>
        <div>
          <span className={styles.bannerBadge}>
            <span className={styles.bannerBadgeDot} />
            Companion Simulator Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabList} role="tablist">
        <button
          className={`${styles.tabButton} ${activeTab === 'start' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('start')}
        >
          1. Check-In & Start Session
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'active' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('active')}
        >
          2. Active Sessions ({heldSessions.length} Held)
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'checkout' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('checkout')}
        >
          3. POS Checkout (Smart Billing)
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'ledger' ? styles.tabButtonActive : ''}`}
          onClick={() => {
            setActiveTab('ledger');
            handlePullLedger();
          }}
        >
          4. Transaction Ledger & Webhooks
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'offline' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('offline')}
        >
          5. Fail-Open & Offline Sync
        </button>
      </div>

      {/* Grid: Simulator Controls on Left, Live API Response & Receipt on Right */}
      <div className={styles.panelGrid}>
        {/* Left Side: Interactive Controls */}
        <div className={styles.formCard}>
          {activeTab === 'start' && (
            <>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Simulate Frontdesk Check-In (Silid OS)</h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.86rem', margin: 0 }}>
                When a student arrives at SILID Malolos, Silid OS checks voucher eligibility and places a temporary hold on the voucher during the study session.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Member Reference
                  <input
                    type="text"
                    value={memberRef}
                    onChange={(e) => setMemberRef(e.target.value)}
                    placeholder="MEM-001"
                  />
                </label>
                <label>
                  Session Reference
                  <input
                    type="text"
                    value={sessionRef}
                    onChange={(e) => setSessionRef(e.target.value)}
                    placeholder="SESS-1001"
                  />
                </label>
              </div>

              <label>
                Personal Voucher Code (PV-...) *
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="e.g. PV-DEMO-SEED-001"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </label>

              <div style={{ fontSize: '0.8rem', background: '#eef6f2', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #c7e2d4' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>💡 Tip: </span>
                Silid OS redeems <strong>Personal Vouchers (PV-...)</strong> issued to students. (Claim tickets starting with <code>CT-</code> are for public student registration).
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Quick Select:</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => setVoucherCode('PV-DEMO-SEED-001')}
                  >
                    PV-DEMO-SEED-001 (Active Demo Voucher)
                  </button>
                  {availableVouchers
                    .filter((v) => v.personal_qr_code !== 'PV-DEMO-SEED-001')
                    .slice(0, 3)
                    .map((v) => (
                      <button
                        key={v.personal_voucher_id}
                        type="button"
                        className="btn"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => setVoucherCode(v.personal_qr_code)}
                      >
                        {v.personal_qr_code}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  Silid OS Cart Items:
                </label>
                <div style={{ display: 'grid', gap: 6 }}>
                  {AVAILABLE_PRODUCTS.map((prod) => (
                    <label
                      key={prod.productCode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: selectedProductCodes.includes(prod.productCode) ? '#f0f7f3' : '#faf9f6',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '0.86rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductCodes.includes(prod.productCode)}
                        onChange={() => toggleProduct(prod.productCode)}
                      />
                      <span style={{ flex: 1 }}>{prod.productName}</span>
                      <strong>₱{prod.unitPrice.toFixed(2)}</strong>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 8, textAlign: 'right', fontWeight: 700 }}>
                  Cart Total: ₱{grossAmount.toFixed(2)}
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  background: hasOtherPromos ? '#fff0ea' : '#fcfbf8',
                  border: hasOtherPromos ? '1px solid var(--color-danger-border)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={hasOtherPromos}
                  onChange={(e) => setHasOtherPromos(e.target.checked)}
                />
                <span>
                  <strong>Customer has other active promotion</strong> (Tests No-Stacking rule)
                </span>
              </label>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleValidate}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Step 1: Validate Voucher
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleHold}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Step 2: Start Session & Hold
                </button>
              </div>
            </>
          )}

          {activeTab === 'active' && (
            <>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Active Floor Sessions (Silid OS)</h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.86rem', margin: 0 }}>
                Vouchers held while a customer is actively studying. If the customer cancels or voids the session, Silid OS releases the hold.
              </p>

              {heldSessions.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  No held sessions yet. Go to Tab 1 to start a session and hold a voucher!
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {heldSessions.map((s) => (
                    <div
                      key={s.sessionRef}
                      style={{
                        padding: 14,
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#fff',
                      }}
                    >
                      <div>
                        <strong>{s.sessionRef}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                          Voucher: <code>{s.voucherCode}</code> (Held at {s.heldAt})
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleRelease(s.sessionRef, s.voucherCode)}
                      >
                        Void / Release Hold
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'checkout' && (
            <>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>POS Smart Billing Checkout (Silid OS)</h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.86rem', margin: 0 }}>
                When the student checks out, Silid OS calls the atomic redemption endpoint. It applies two-phase locking (`voucher_batch` then `personal_voucher`) to prevent double redemption.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Session Ref
                  <input
                    type="text"
                    value={sessionRef}
                    onChange={(e) => setSessionRef(e.target.value)}
                  />
                </label>
                <label>
                  Voucher Code
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ padding: 12, background: '#f5f4ef', borderRadius: 'var(--radius-sm)' }}>
                <strong>Checkout Cart Total:</strong> ₱{grossAmount.toFixed(2)} ({cartItems.length} items)
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRedeem}
                disabled={loading}
                style={{ height: 48, fontWeight: 700 }}
              >
                {loading ? 'Processing Atomic Checkout…' : '💳 Complete Checkout & Redeem Voucher'}
              </button>
            </>
          )}

          {activeTab === 'ledger' && (
            <>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Transaction Ledger Integration (Silid OS)</h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.86rem', margin: 0 }}>
                Silid OS pulls signed ledger events or receives webhooks for redemptions, reversals, and expirations.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePullLedger}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  📥 Pull Ledger Events (/api/v1/ledger/pull)
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleReverse}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  ↩ Reverse Redemption (/reverse)
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Ledger Outbox Stream ({ledgerEvents.length} events)</h3>
                {ledgerEvents.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                    Click &apos;Pull Ledger Events&apos; to query the outbox queue.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {ledgerEvents.map((ev, idx) => (
                      <div
                        key={ev.outbox_id || idx}
                        style={{
                          padding: 10,
                          background: '#fff',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{ev.event_type}</span>
                          <span style={{ color: 'var(--color-muted)' }}>{ev.created_at?.slice(0, 19)}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--color-muted)', marginTop: 4 }}>
                          {JSON.stringify(ev.payload)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'offline' && (
            <>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Fail-Open & Offline Sync (Silid OS)</h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.86rem', margin: 0 }}>
                If the voucher microservice is temporarily unreachable, Silid OS logs offline redemptions locally without blocking student entry, and syncs them once back online.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOfflineSync}
                disabled={loading}
                style={{ height: 44 }}
              >
                📡 Submit Simulated Offline Redemptions Batch
              </button>
            </>
          )}
        </div>

        {/* Right Side: Live API Response Inspector & Simulated Thermal Receipt */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Thermal Receipt Preview if Redeemed */}
          {receiptData && (
            <div className={styles.receiptPaper}>
              <div className={styles.receiptHeader}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>SILID MALOLOS STUDY HUB</div>
                <div>Customer Checkout Receipt</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Session: {receiptData.sessionRef}</div>
              </div>

              {receiptData.cartItems.map((item: LineItem) => (
                <div key={item.productCode} className={styles.receiptRow}>
                  <span>{item.productName}</span>
                  <span>₱{item.unitPrice.toFixed(2)}</span>
                </div>
              ))}

              <div className={styles.receiptDivider} />

              <div className={styles.receiptRow}>
                <span>Gross Subtotal:</span>
                <span>₱{receiptData.grossAmount.toFixed(2)}</span>
              </div>

              <div className={styles.receiptRow} style={{ color: '#1f5d46', fontWeight: 700 }}>
                <span>Voucher Discount ({receiptData.discountPercent}%):</span>
                <span>-₱{receiptData.discountAmount.toFixed(2)}</span>
              </div>

              <div className={styles.receiptDivider} />

              <div className={`${styles.receiptRow} ${styles.receiptTotal}`}>
                <span>NET AMOUNT DUE:</span>
                <span>₱{receiptData.netAmount.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: 14, fontSize: '0.72rem', color: '#777', textAlign: 'center' }}>
                Voucher Applied: {receiptData.voucherCode}<br />
                {receiptData.redeemedAt}<br />
                <em>Thank you for studying at SILID!</em>
              </div>
            </div>
          )}

          {/* JSON Inspector */}
          <div className={styles.resultCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2d3830', paddingBottom: 8 }}>
              <strong>API Inspector</strong>
              <span style={{ color: lastResponse?.ok ? '#34d399' : '#f87171' }}>
                {lastEndpoint ? `${lastEndpoint} (${lastResponse?.status || 200})` : 'Awaiting Action'}
              </span>
            </div>
            <pre style={{ margin: 0, overflowX: 'auto', maxHeight: 380 }}>
              {lastResponse ? JSON.stringify(lastResponse.data || lastResponse, null, 2) : '// Click an action on the left to inspect the live response.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
