# SILID Voucher Service — Test Cases

> **How to read, run, and extend the test suite for the SILID Malolos Voucher System.**

---

## Overview

The test suite covers **75 acceptance test cases** across **13 functional modules**, verifying every flow from the system diagrams in `reference/SiliD_Complete_System_Diagrams.pdf`.

| Item | Detail |
|---|---|
| **Automated test suites** | 6 Vitest suites · 53 tests · 100% passing |
| **Manual / UI test cases** | 75 cases across Modules 1–13 |
| **Companion simulator** | [http://localhost:3000/staff/simulator](http://localhost:3000/staff/simulator) |
| **Staff portal** | [http://localhost:3000/staff](http://localhost:3000/staff) |

---

## Running the Automated Tests

> **Windows PowerShell users:** Use `npm.cmd` instead of `npm` if you get a script execution policy error.

```bash
# From the project root:
cd 04_SOFTWARE_APPLICATION/Source_Code

# Run all tests (one-shot, no watch mode)
npm test

# PowerShell alternative
npm.cmd test
```

Expected output — all 53 tests should pass in under 3 seconds:

```
Test Files  6 passed (6)
     Tests  53 passed (53)
  Duration  ~1.5s
```

---

## Test Suites at a Glance

| File | What it Tests | Key Rules Verified |
|---|---|---|
| `pricing-strategy.test.ts` | Percentage discounts 1–100%, free passes, exclusions | §3 — Single-voucher, non-stacking only |
| `timezone-business-day.test.ts` | PHT (Asia/Manila, UTC+8) expiry at 23:59:59.999 | §6 — Timezone correctness |
| `api-validation-rules.test.ts` | Eligibility checks, `NO_STACKING`, excluded products | §5 Flow 5, §6 |
| `atomic-redemption.test.ts` | Two-phase row locking, single-use guarantee, batch caps, reversal | §6 — Concurrency safety |
| `database-rules.test.ts` | FK triggers, 1-to-1 issuance, rejection QR prohibition | §5 Flow 4 |
| `master-client-test-cases.test.ts` | End-to-end scenario: TC-01 → TC-75, all 13 modules | Full system validation |

---

## Module Summary (75 Test Cases)

| Module | Name | TCs | How to Test |
|---|---|---|---|
| **1** | Staff Authentication & RBAC | TC-01 – TC-05 | UI: `/staff/login` |
| **2** | Voucher Template Management | TC-06 – TC-11 | UI: `/staff/templates` |
| **3** | Event Batch Generation & Claim Tickets | TC-12 – TC-17 | UI: `/staff/batches` |
| **4** | Public Student Claim Registration | TC-18 – TC-23 | UI: `/register/CT-YTR-003` |
| **5** | Staff Registration Review & Voucher Issuance | TC-24 – TC-29 | UI: `/staff/registrations` |
| **6** | Staff Mobile & Terminal Voucher Redemption | TC-30 – TC-36 | UI: `/staff/redeem` |
| **7** | Silid OS API Integration & Fail-Open | TC-37 – TC-45 | API or Simulator Tab 1–5 |
| **8** | Transaction Ledger Reversals & Refunds | TC-46 – TC-49 | UI: `/staff/reports` or API |
| **9** | Business Reports & Audit Trail | TC-50 – TC-54 | UI: `/staff/reports`, `/staff/audit` |
| **10** | Legacy Voucher CSV Import | TC-55 – TC-58 | UI: `/staff/import` |
| **11** | Administration, Security & System Settings | TC-59 – TC-63 | UI: `/staff/admin` |
| **12** | Scheduled Jobs & Cron Automation | TC-64 – TC-65 | API: `/api/cron/...` |
| **13** | Interactive Companion Simulation | TC-66 – TC-72 | UI: `/staff/simulator` |

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Founder Admin** | `founder@silid.ph` | `password123` |
| **Frontdesk Staff** | `staff@silid.ph` | `password123` |

---

## Quick Manual Test Walkthrough

The fastest way to validate the full flow end-to-end (no Supabase required — works in mock mode):

### Step 1 — Login (TC-01)
1. Go to [http://localhost:3000/staff/login](http://localhost:3000/staff/login)
2. Sign in as `founder@silid.ph` / `password123`

### Step 2 — Create a Template (TC-06)
1. Go to `/staff/templates`
2. Create a template: **Name** `Test 20% Off`, **Discount** `20`, **Duration** `30` days
3. Click **Create Template** — it should appear in the table as `Active`

### Step 3 — Generate a Batch (TC-12 & TC-13)
1. Go to `/staff/batches`
2. Select the template, fill in event details, set **Batch Quantity** to `5` and **Max Redemptions** to `3`
3. Click **Generate Batch & QRs** — you should see the QR card preview immediately
4. Try setting **Max Redemptions** to `10` (more than quantity 5) — you should see an error banner: *"Max redemptions must be greater than 0 and less than or equal to batch quantity."*

### Step 4 — Student Registration (TC-18)
1. Open [http://localhost:3000/register/CT-YTR-003](http://localhost:3000/register/CT-YTR-003) in an incognito window
2. Fill in Student ID, Name, Email, Mobile, check the DPA checkbox
3. Submit — you should receive a `/status/[token]` link

### Step 5 — Approve & Issue Voucher (TC-25)
1. Go to `/staff/registrations` → **Pending** tab
2. Click **Approve & Issue Voucher** on the new registration
3. Open the student's `/status/[token]` link — the QR code should now appear

### Step 6 — API Test via PowerShell (TC-37, TC-42, TC-43)

```powershell
# Validate a voucher
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/vouchers/validate" `
  -Method POST `
  -Headers @{ "X-API-Key" = "sk_live_demo123" } `
  -ContentType "application/json" `
  -Body '{ "personal_qr_code": "PV-DEMO-SEED-002", "member_ref": "MEM-002", "gross_amount": 180 }' |
  ConvertTo-Json -Depth 5

# Redeem a voucher (first time)
$body = @{
    personal_qr_code = "PV-DEMO-SEED-002"
    session_ref      = "SES-TEST-001"
    idempotency_key  = "idemp_test_001"
    line_items       = @(
        @{ productCode = "PASS_3HR"; productName = "3-Hour Pass"; quantity = 1; unitPrice = 180.00 }
    )
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/vouchers/redeem" `
  -Method POST -Headers @{ "X-API-Key" = "sk_live_demo123" } `
  -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 5

# Replay (same idempotency_key) — should return cached result, not double-redeem (TC-43)
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/vouchers/redeem" `
  -Method POST -Headers @{ "X-API-Key" = "sk_live_demo123" } `
  -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 5
```

### Step 7 — Companion Simulator (TC-66 – TC-72)
1. Go to [http://localhost:3000/staff/simulator](http://localhost:3000/staff/simulator)
2. Work through each tab in order:
   - **Tab 1:** Validate → Hold session
   - **Tab 2:** View active session → Void/release hold
   - **Tab 3:** Complete checkout (generates receipt)
   - **Tab 4:** Pull ledger events → Reverse a redemption
   - **Tab 5:** Submit offline batch sync

---

## API Key for Testing

The seeded demo key works in mock mode out-of-the-box:

```
X-API-Key: sk_live_demo123
```

To generate a new key: go to `/staff/admin` → **API Keys** → **+ Generate New API Key**.

---

## Adding New Test Cases

1. Open `src/__tests__/master-client-test-cases.test.ts`
2. Add your test inside the matching `describe` block (match the module number)
3. Import any new actions from `src/lib/voucher-validator.ts` or `src/lib/supabase/admin.ts`
4. Run `npm.cmd test` to verify — all 53 existing tests must still pass

---

## Related Documentation

| Document | Purpose |
|---|---|
| [`COMPANION_MODE_GUIDE.md`](./COMPANION_MODE_GUIDE.md) | Local Simulator Mode vs. Production Companion Mode |
| [`../README.md`](../README.md) | Project overview, architecture, and API reference |
| [`Database/er_diagram.md`](./Database/er_diagram.md) | Entity-Relationship Diagram |
| [`Deployment_Files/silid-os-integration-guide.md`](./Deployment_Files/silid-os-integration-guide.md) | Silid OS integration guide for the client's dev team |
