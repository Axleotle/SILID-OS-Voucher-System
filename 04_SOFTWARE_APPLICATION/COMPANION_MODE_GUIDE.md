# Companion System Architecture & Testing Guide

> **Standalone Voucher Microservice for SILID Malolos**  
> Understanding Dual-Mode Operation: **Local Simulator Mode** vs. **Production Companion Mode**

---

## 1. Background & Architecture

The **SILID Voucher Service** was commissioned as a standalone microservice to replace hardcoded voucher logic in the client's existing primary system, **"Silid OS"**.

```
+-------------------------------------------------------------+
|                      SILID MALOLOS                          |
+-------------------------------------------------------------+
|                                                             |
|   PRIMARY CLIENT SYSTEM:                    STANDALONE:     |
|   =====================              ====================   |
|   "Silid OS"                         SILID Voucher Service  |
|   - Check-in & Desk Reservations     - Voucher Templates    |
|   - Active Study Sessions            - Batch Claim Tickets  |
|   - Smart Billing Checkout           - Public Registration  |
|   - Transaction Ledger               - Staff QR Issuance    |
|   - Member Accounts                  - Atomic Redemptions   |
|                                      - Audit Trail          |
|              \                                /             |
|               \                              /              |
|                v                            v               |
|            REST API: /api/v1/vouchers/... (Idempotent)      |
|            HMAC Signed Webhooks: Ledger Synchronization     |
+-------------------------------------------------------------+
```

Because this service is a **companion** to Silid OS, evaluating or demonstrating it **without the companion system running** could lead to confusion or integration errors. To solve this, the application natively supports **two distinct modes**:

1. **Mode A (Local Demonstration Mode):** Built-in **Silid OS Companion Simulator** — zero external dependencies, no need to have the client's proprietary Silid OS repo installed.
2. **Mode B (Production Companion Mode):** Plugs directly into the client's live **Silid OS** running on Vercel via versioned HTTP APIs and webhooks.

---

## 2. Mode A: Local Demonstration Mode (Fake Companion System)

### What It Is
Within this project, we have built a **fully interactive Silid OS Simulator** located at:
👉 **[http://localhost:3000/staff/simulator](http://localhost:3000/staff/simulator)**

This simulator replicates all integration touchpoints of Silid OS so evaluators and testers can test the complete two-system interaction end-to-end:

| Touchpoint | What Silid OS Does | How to Test in the Simulator (`/staff/simulator`) |
|---|---|---|
| **1. Start Session (Check-In)** | Verifies voucher eligibility & puts voucher on hold | Select a member (`MEM-001`), add study desk passes, click **"Step 1: Validate Voucher"** then **"Step 2: Start Session & Hold"**. |
| **2. Active Floor Sessions** | Tracks held vouchers while students study | Go to Tab 2 **"Active Sessions"** to view held vouchers or click **"Void / Release Hold"** to simulate an aborted session. |
| **3. POS Smart Billing Checkout** | Applies atomic discount & generates receipt | Go to Tab 3 **"POS Checkout"**, click **"Complete Checkout & Redeem Voucher"** to observe two-phase locking and view the generated **thermal receipt**. |
| **4. Transaction Ledger Synchronization** | Records financial events in central ledger | Go to Tab 4 **"Transaction Ledger"**, click **"Pull Ledger Events"** to inspect queued outbox events or **"Reverse Redemption"** to test refunds. |
| **5. Fail-Open Offline Sync** | Queues local scans when offline | Go to Tab 5 **"Fail-Open & Offline Sync"** to submit batch offline redemptions. |

### How It Works Under the Hood
- The Simulator sends standard HTTP REST requests to `/api/v1/...` identical to the ones real Silid OS sends.
- It includes the `X-Silid-Simulator: true` or `X-API-Key: sk_live_demo123` header, which our authentication engine recognizes without requiring manual API key setup.
- **Zero Errors:** All calls execute against our atomic redemption and validation engine cleanly.

---

## 3. Mode B: Production Companion Mode (Real Silid OS Integration)

When deploying for production at SILID Malolos:

### 1. API Configuration
Provide the Silid OS engineering team with your production URL and generated API key:
- **Base URL:** `https://vouchers.silid.ph` (or your deployed Vercel URL)
- **API Key Header:** `X-API-Key: sk_live_...` (generated via `/staff/admin`)

### 2. Silid OS Integration Points
Silid OS calls the following endpoints:
- `POST /api/v1/vouchers/validate`: At check-in to display real-time discounts on the customer terminal.
- `POST /api/v1/vouchers/hold`: When a student checks in, preventing the voucher from being scanned elsewhere while the session is open.
- `POST /api/v1/vouchers/release`: If the study session is cancelled or voided.
- `POST /api/v1/vouchers/redeem`: At checkout payment. Shares the identical atomic function used by staff mobile scanners.
- `POST /api/v1/vouchers/reverse`: When an audit refund occurs.
- `GET /api/v1/ledger/pull`: Nightly or recurring cron to reconcile Silid OS Transaction Ledger.

### 3. Webhook Delivery
When vouchers are redeemed or expired, this service dispatches HMAC-SHA256 signed webhooks to Silid OS:
- Set `LEDGER_WEBHOOK_URL=https://silid-os.client.ph/api/webhooks/voucher` in `.env`.
- Set `LEDGER_WEBHOOK_SECRET=your-production-signing-secret`.
- Silid OS verifies the `X-Silid-Signature` header against the payload.

### 4. Fail-Open Resilience (§2 Architecture)
If this voucher service is ever temporarily unreachable (e.g. network timeout):
- Silid OS continues allowing study sessions (does not lock out customers).
- Silid OS logs the voucher code and gross amount locally.
- When connection recovers, Silid OS sends the offline scans to `POST /api/v1/vouchers/offline-sync` for reconciliation.

---

## 4. How to Conduct a Project Demonstration

For evaluators or client presentations:

1. **Start the Service:**
   - Double-click [`04_SOFTWARE_APPLICATION/Executable/start.bat`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Executable/start.bat).
   - Log in at `http://localhost:3000/staff` using `founder@silid.ph` / `password123`.

2. **Demonstrate the Voucher Service Lifecycle:**
   - Create a template under **Templates**.
   - Generate a batch with printable cards under **Batches & Tickets**.
   - Open a ticket registration in an incognito window: `http://localhost:3000/register/CT-YTR-003`.
   - In the Staff Portal, approve the registration under **Registrations** to issue a personal voucher (`PV-...`).

3. **Demonstrate Companion System Integration via Simulator:**
   - Click **🖥️ Silid OS Simulator** in the navigation bar (`/staff/simulator`).
   - Click **Step 1: Validate Voucher** to show live discount calculation.
   - Click **Step 2: Start Session & Hold** to show active session locking.
   - Go to Tab 3 and click **Complete Checkout & Redeem Voucher** to observe the generated thermal receipt and atomic lock.
   - Go to Tab 4 and click **Pull Ledger Events** to verify transaction synchronization.
