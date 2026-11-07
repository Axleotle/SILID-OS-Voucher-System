# SILID Voucher Service

> **Standalone Voucher System for SILID Malolos Study Hub**  
> Built with Next.js (App Router) + TypeScript on Vercel and standalone Supabase PostgreSQL.  
> Directly implementing the authoritative domain model, 13 system diagrams, and implementation rules from `reference/SiliD_Complete_System_Diagrams.pdf`.

---

## 1. What It Does

The **SILID Voucher Service** replaces legacy hardcoded voucher logic in Silid OS with a standalone microservice. It allows SILID Malolos to:
1. **Manage Reusable Templates:** Configure percentage discount presets (1–100%) with custom durations, restrictions, and product exclusion lists (Intensive Pass, Hub Reservations).
2. **Generate Event Batches:** Produce batches of physical/digital claim cards with cryptographically unique codes (`CT-...`) and QR codes for student and community partner events.
3. **Public Student Registration:** Students scan claim QRs or type codes, review event privileges, accept the Philippine Data Privacy Act (RA 10173) agreement, and register.
4. **Staff Review & Instant Issuance:** Staff review pending claims, reject with mandatory feedback, or approve to generate personal voucher QRs (`PV-...`) sent via automated branded email.
5. **Atomic Checkout Redemption:** Mobile camera scanning and terminal checkout sharing a concurrency-safe atomic lock (`voucher_batch FOR UPDATE` → `personal_voucher FOR UPDATE`).
6. **Silid OS Integration API:** Versioned HTTP REST API (`/api/v1/...`) with HMAC-SHA256 authenticated API keys, rate limiting, fail-open resilience, and offline sync.
7. **Reports & Audit Trail:** Philippine Standard Time (PST / PHT, GMT+8) reports that reconcile with the Silid OS Transaction Ledger, complete with reversal capabilities.

---

## 2. Quick Run Guide (Under 10 Minutes)

### Prerequisites
- **Node.js**: v18.17+ or v20+ ([https://nodejs.org](https://nodejs.org))
- **npm** (included with Node.js)
- *Note:* **No database installation is required** — the service includes an automatic **Zero-Dependency In-Memory Mock Mode** for quick demonstration if Docker, Supabase, or PostgreSQL are not installed. Detailed instructions are in [`04_SOFTWARE_APPLICATION/Executable/RUN.md`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Executable/RUN.md).

### One-Click Launch
- **Windows:** Double-click [`04_SOFTWARE_APPLICATION/Executable/start.bat`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Executable/start.bat)
- **macOS / Linux:** Run `bash 04_SOFTWARE_APPLICATION/Executable/start.sh`

### Manual Commands
```bash
cd 04_SOFTWARE_APPLICATION/Source_Code
cp .env.example .env
npm install
npm run dev
```

Browse to:
- **Staff Portal:** [http://localhost:3000/staff](http://localhost:3000/staff)
- **Silid OS Companion Simulator:** [http://localhost:3000/staff/simulator](http://localhost:3000/staff/simulator) *(Simulates the client's Silid OS system locally)*
- **Claim Ticket Registration Demo:** [http://localhost:3000/register/CT-YTR-003](http://localhost:3000/register/CT-YTR-003)
- **Service Health Probe:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

> **Testing Architecture & Demonstration Modes:**  
> Detailed guide on running in **Local Simulator Mode** vs. **Production Companion Mode** is documented in [`04_SOFTWARE_APPLICATION/COMPANION_MODE_GUIDE.md`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/COMPANION_MODE_GUIDE.md).  
> For the complete 75 test case specification and step-by-step manual testing guide, see [`04_SOFTWARE_APPLICATION/TEST_CASES.md`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/TEST_CASES.md).

---

## 3. Demo Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Founder** | `founder@silid.ph` | `password123` | Full control, bulk batch approval, reversals, API keys, flags |
| **Staff** | `staff@silid.ph` | `password123` | Review registrations, redeem QRs, view reports |

---

## 4. Architecture & Security

```
+---------------------------------------------------------+
|                  SILID MALOLOS STUDY HUB                |
+---------------------------------------------------------+
       |                                      |
       | HTTPS (API Key Auth)                 | Public Web / Staff UI
       v                                      v
+---------------------------------------------------------+
|               SILID VOUCHER SERVICE (Next.js)           |
|                                                         |
|  /api/v1/vouchers/validate  - Session Start & Check-in  |
|  /api/v1/vouchers/hold      - Active Session Lock       |
|  /api/v1/vouchers/release   - Session Voided            |
|  /api/v1/vouchers/redeem    - Checkout (Atomic)         |
|  /api/v1/vouchers/reverse   - Ledger Reversal           |
|  /api/v1/vouchers/offline   - Offline Reconciliation    |
+---------------------------------------------------------+
       |
       v
+---------------------------------------------------------+
|         STANDALONE SUPABASE POSTGRESQL DATABASE         |
|                                                         |
|  Row Level Security (RLS) · Dual-Row Concurrency Locks  |
|  Partial Unique Indexes   · SHA-256 Hashed API Keys     |
+---------------------------------------------------------+
```

- **Fail-Open Strategy:** If the voucher microservice is unreachable, Silid OS logs offline scans without blocking customer study sessions and syncs later via `/api/v1/vouchers/offline-sync`.
- **Promotion Integrity:** Vouchers strictly **cannot stack** with any other promotion or voucher (`has_other_promotions` check).
- **Concurrency Locking:** Dual-level locking in PostgreSQL function `atomic_redeem_voucher`: locks `voucher_batch` first to protect batch caps, then `personal_voucher` to prevent double-spending.
- **Timezone Standard:** Timestamps stored in UTC and rendered in **Philippine Standard Time (PST / PHT, GMT+8)**. Standard calendar days run midnight to midnight (00:00:00 to 23:59:59 PHT) with voucher expiry at 23:59:59.999 PHT.

---

## 5. Traceability Matrix (Diagrams to Implementation)

Mapping every diagram from `reference/SiliD_Complete_System_Diagrams.pdf` to the corresponding source code, database migrations, and automated tests:

| # | Diagram Name | Implementation Files | Automated Test Coverage |
|---|---|---|---|
| **1** | System Architecture Diagram | [`src/app/api/v1/...`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/api/v1), [`silid-os-integration-guide.md`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Deployment_Files/silid-os-integration-guide.md) | `api-validation-rules.test.ts` |
| **2** | Core Domain ERD | [`001_initial_schema.sql`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Database/migrations/001_initial_schema.sql), [`er_diagram.md`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Database/er_diagram.md) | `database-rules.test.ts` |
| **3** | Student Use Case Diagram | [`/register/[claimCode]/page.tsx`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/register/[claimCode]/page.tsx), [`/status/[token]/page.tsx`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/status/[token]/page.tsx) | `api-validation-rules.test.ts` |
| **4** | Staff Use Case Diagram | [`/staff/...`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/(staff)/staff), [`StaffShell.tsx`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/components/staff/StaffShell.tsx) | `atomic-redemption.test.ts` |
| **5** | Activity 1: Manage Template | [`/staff/templates/page.tsx`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/(staff)/staff/templates/page.tsx), [`templates/actions.ts`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/(staff)/staff/templates/actions.ts) | `pricing-strategy.test.ts` |
| **6** | Activity 2: Generate Batch & Tickets | [`/staff/batches/page.tsx`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/(staff)/staff/batches/page.tsx), [`batches/actions.ts`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/(staff)/staff/batches/actions.ts) | `database-rules.test.ts` |
| **7** | Activity 3: Student Registration | [`RegistrationForm.tsx`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/components/public/RegistrationForm.tsx), [`api/v1/register/route.ts`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/api/v1/register/route.ts) | `api-validation-rules.test.ts` |
| **8** | Activity 4: Review & Issue Voucher | [`/staff/registrations/actions.ts`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/app/(staff)/staff/registrations/actions.ts), [`email/index.ts`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/lib/email/index.ts) | `atomic-redemption.test.ts` |
| **9** | Sequence 1: Template Lifecycle | [`src/lib/pricing/...`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/lib/pricing), [`voucher_template` table](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Database/migrations/001_initial_schema.sql) | `pricing-strategy.test.ts` |
| **10** | Sequence 2: Batch & Ticket Issuance | [`QRCodeGenerator.generateClaimCode`](file:///c:/Users/axle/Downloads/3rd%20Yr%20-%201st%20Sem/esdi/SILID%20OS%20Voucher%20System/04_SOFTWARE_APPLICATION/Source_Code/src/lib/qr.ts), `claim_ticket` | `database-rules.test.ts` |
| **11** | Sequence 3: Student Registration | `UNIQUE(student_id, batch_id)`, `trg_check_ticket_batch` | `api-validation-rules.test.ts` |
| **12** | Sequence 4: Staff Review & Email | `calculateExpiryDate`, `sendEmailWithOutbox` | `timezone-business-day.test.ts` |
| **13** | Sequence 5: Atomic Redemption | `atomic_redeem_voucher` (RPC), `idx_redemption_active_per_voucher` | `atomic-redemption.test.ts` |

---

## 6. API Reference (Selected Concrete Examples)

### Validate Voucher (`POST /api/v1/vouchers/validate`)
```bash
curl -X POST https://vouchers.silid.ph/api/v1/vouchers/validate \
  -H "X-API-Key: sk_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "personal_qr_code": "PV-9A8B7C6D5E4F3A2B",
    "member_ref": "MEM-1082",
    "has_other_promotions": false,
    "line_items": [
      { "productCode": "FP_DAILY", "productName": "Daily Focus Pass", "quantity": 1, "unitPrice": 180.00 }
    ]
  }'
```
**Response (HTTP 200):**
```json
{
  "eligible": true,
  "voucher_id": "f0000000-0000-0000-0000-000000000001",
  "template_name": "30-Day Focus Access Privilege",
  "discount_percent": 20,
  "gross_amount": 180.00,
  "discount_amount": 36.00,
  "net_amount": 144.00,
  "expiry_date": "2026-12-06T15:59:59.999Z",
  "response_ms": 32
}
```

### Redeem Voucher (`POST /api/v1/vouchers/redeem`)
```bash
curl -X POST https://vouchers.silid.ph/api/v1/vouchers/redeem \
  -H "X-API-Key: sk_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "personal_qr_code": "PV-9A8B7C6D5E4F3A2B",
    "idempotency_key": "idemp-checkout-sess-1082",
    "session_ref": "SES-1082",
    "has_other_promotions": false
  }'
```
**Response (HTTP 200):**
```json
{
  "success": true,
  "redemption_id": "9812-abcd-ef01-2345",
  "receipt_text": "Voucher: PV-9A8B7C6D... | Discount: 20%",
  "discount_percent": 20
}
```

---

## 7. Open Items & Client Configuration (§12)

The following items are configurable in the database and code without breaking core diagrams:

1. **`expiryDate` Start Policy:** Defaults to **Issuance Date** (`calculateExpiryDate` = `issuedAt + effectiveDuration`). "First use" and "staff activation" policies can be toggled once confirmed with SILID Malolos.
2. **Ledger Webhook Format:** Webhook payload currently sends `{ event, voucherId, redemptionId, discountAmount, netAmount, timestamp }`. Can be customized in `src/jobs/process-outbox.ts` to match Silid OS exact schema.
3. **Member Reference Mapping:** Silid OS sends `member_ref` which is stored in `student.silid_member_ref`. Maps 1:1 or via institutional student ID.
4. **Old Voucher Import Format:** Supported with flexible column mapper (mapping `code`, `type`, `value`, `notes`). Legacy non-percentage vouchers are safely marked `legacy_unsupported` and kept non-redeemable.
5. **Email Provider & Branding:** Email abstraction (`src/lib/email/index.ts`) supports `stub` (local/testing), Resend, or SendGrid via `EMAIL_PROVIDER`. Colors and typography are centralized in `src/lib/theme.ts`.
6. **Approval Thresholds:** High-risk actions (bulk batches &gt; 50 tickets) enforce Founder/Manager authorization. Threshold is adjustable via `BULK_THRESHOLD` in `batches/actions.ts`.

---

## 8. Known Limitations & Exclusions (§3)

- **First-Release Scope:** Vouchers support **Percentage Discounts only** (1–100%). Fixed-peso off, fixed final price, complimentary passes, and free-hour service recovery vouchers are modeled in the architecture but intentionally disabled in v1.
- **Single Active Redemption:** A voucher can only be used once. Reversals return the voucher to `Active` and decrement the campaign cap.
