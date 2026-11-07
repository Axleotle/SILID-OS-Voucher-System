# SILID Voucher Service — Master Client Acceptance Test Specification

> **Comprehensive Test Plan & Test Cases for SILID Malolos Study Hub**  
> Direct verification of all 13 system diagrams from `reference/SiliD_Complete_System_Diagrams.pdf`, the core domain rules, and all integration extensions.

---

## Document Overview

This document provides the **exhaustive test specification** covering **every action and capability the client (SILID Malolos), hub staff, students, and the primary system (Silid OS)** need to perform using the SILID Voucher Service.

### Quick Links
- **Total Test Cases:** 75 Test Cases across 13 Functional Modules
- **Automated Vitest Test Suites:** 5 Suites (16 tests, 100% passing)
- **Built-in Companion Simulator:** [http://localhost:3000/staff/simulator](http://localhost:3000/staff/simulator)
- **Staff Portal URL:** [http://localhost:3000/staff](http://localhost:3000/staff)

---

## Table of Contents

1. [Automated Test Execution](#1-automated-test-execution)
2. [Module 1: Staff Authentication & Role-Based Access Control](#module-1-staff-authentication--role-based-access-control-7)
3. [Module 2: Voucher Template Management](#module-2-voucher-template-management-5-flow-1)
4. [Module 3: Event Batch Generation & Claim Tickets](#module-3-event-batch-generation--claim-tickets-5-flow-2)
5. [Module 4: Public Student Claim Registration](#module-4-public-student-claim-registration-5-flow-3)
6. [Module 5: Staff Registration Review & Voucher Issuance](#module-5-staff-registration-review--voucher-issuance-5-flow-4)
7. [Module 6: Staff Mobile & Terminal Voucher Redemption](#module-6-staff-mobile--terminal-voucher-redemption-5-flow-5)
8. [Module 7: Silid OS API Integration & Fail-Open Behavior](#module-7-silid-os-api-integration--fail-open-behavior-6)
9. [Module 8: Transaction Ledger Reversals & Refunds](#module-8-transaction-ledger-reversals--refunds-6)
10. [Module 9: Business Reports & Audit Trail](#module-9-business-reports--audit-trail-7)
11. [Module 10: Legacy Voucher CSV Import](#module-10-legacy-voucher-csv-import-3-6)
12. [Module 11: Administration, Security & System Settings](#module-11-administration-security--system-settings-7)
13. [Module 12: Scheduled Jobs & Cron Automation](#module-12-scheduled-jobs--cron-automation-6)
14. [Module 13: Interactive Companion Simulation](#module-13-interactive-companion-simulation-6)
15. [Traceability Matrix to System Diagrams](#15-traceability-matrix-to-system-diagrams)

---

## 1. Automated Test Execution

To execute the automated regression test suite:
```bash
cd 04_SOFTWARE_APPLICATION/Source_Code
npm test
```

### Automated Suites Summary
1. **`pricing-strategy.test.ts`**: Verifies percentage discounts (1–100%), 100% free passes, non-discountable exclusions, and disabled legacy strategies.
2. **`timezone-business-day.test.ts`**: Verifies Philippine Standard Time (PST / PHT, GMT+8) adherence, midnight-to-midnight calendar days, and end-of-day (23:59:59.999 PHT) expiry calculations.
3. **`api-validation-rules.test.ts`**: Verifies eligibility checks, discount calculations on eligible items, and strict rejection of promotion stacking (`NO_STACKING`).
4. **`atomic-redemption.test.ts`**: Verifies two-phase row locking, single-use guarantees, batch caps (`maxRedemptions`), and reversal state restoration.
5. **`database-rules.test.ts`**: Verifies database triggers (`claim_ticket.batch_id = registration.batch_id`), 1-to-1 Approved registration issuance, and rejection QR prohibition.

---

## Module 1: Staff Authentication & Role-Based Access Control (§7)

### TC-01: Founder Admin Login & Dashboard Access
- **Actor:** Founder Admin (`founder@silid.ph`)
- **Precondition:** Server is running on `http://localhost:3000`.
- **Steps:**
  1. Navigate to `http://localhost:3000/staff/login`.
  2. Enter Email: `founder@silid.ph`, Password: `password123`.
  3. Click **Sign In to Voucher Center**.
- **Expected Result:**
  - Authenticates immediately without network timeout.
  - Redirects to `/staff`.
  - Header displays `Founder Admin` with a golden **Founder** badge.
  - KPI metric cards load with current operational stats.

### TC-02: Frontdesk Staff Login & Role Assignment
- **Actor:** Frontdesk Staff (`staff@silid.ph`)
- **Steps:**
  1. Log out or open incognito window at `http://localhost:3000/staff/login`.
  2. Enter Email: `staff@silid.ph`, Password: `password123`.
  3. Click **Sign In to Voucher Center**.
- **Expected Result:**
  - Header displays `Frontdesk Staff` with a green **Staff** badge.
  - Staff permissions allow reviewing registrations, scanning vouchers, and viewing reports.

### TC-03: Invalid Credentials Rejection
- **Actor:** Unauthorized User
- **Steps:**
  1. On `/staff/login`, enter Email: `unknown@silid.ph`, Password: `wrongpassword`.
  2. Click **Sign In to Voucher Center**.
- **Expected Result:**
  - Access is denied.
  - Red error alert displays: *"Invalid credentials. Please verify your email and password."*
  - User remains on login screen.

### TC-04: Role Permission Boundaries (Approval Thresholds §7)
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Log in as `staff@silid.ph`.
  2. Attempt to create a bulk voucher batch with quantity `100` (> 50 bulk threshold).
- **Expected Result:**
  - Action is blocked.
  - Error displayed: *"Batches larger than 50 tickets require Founder or Manager authorization (§7 Approval Thresholds)."*

### TC-05: Session Persistence & Instant Sign-Out
- **Actor:** Staff Member
- **Steps:**
  1. Refresh the browser while logged in $\to$ session persists without re-prompting login.
  2. Click **Sign Out** in the top navigation.
- **Expected Result:**
  - Session cookie is cleared.
  - User is immediately redirected to `/staff/login`.
  - Attempting to visit `/staff` directly redirects back to login.

---

## Module 2: Voucher Template Management (§5 Flow 1)

### TC-06: Create Standard Percentage Discount Template (1% to 99%)
- **Actor:** Founder Admin
- **Steps:**
  1. Navigate to `/staff/templates`.
  2. Under "+ Create New Voucher Template", enter:
     - **Template Name:** `Midterm Study Marathon 25%`
     - **Discount Percentage:** `25`
     - **Effective Duration:** `14` days
     - **Description:** `Finals week study pass discount`
     - **Restrictions:** `Valid for open study desks only.`
  3. Click **Create Template**.
- **Expected Result:**
  - Template is saved with status `Active`.
  - Appears in templates table showing `25% off` and `14 days`.
  - Audit log records `TEMPLATE_CREATED`.

### TC-07: Create 100% Free Study Pass Template
- **Actor:** Founder Admin
- **Steps:**
  1. In `/staff/templates`, create template with `Discount Percentage: 100`.
- **Expected Result:**
  - Successfully creates a 100% discount template (Free Pass).
  - Displays as `100% (Free Pass)` in the interface.

### TC-08: Validation of Percentage Range
- **Actor:** Founder Admin
- **Steps:**
  1. Try creating a template with `Discount Percentage: 0` or `105`.
- **Expected Result:**
  - Form validation blocks submission (percentage must be an integer between 1 and 100).

### TC-09: Configure Structured Product Exclusions
- **Actor:** Founder Admin
- **Steps:**
  1. Create a template and inspect default exclusions.
- **Expected Result:**
  - Template includes excluded product codes (`PASS_INTENSIVE`, `HUB_RESERVATION`).
  - Restrictions text explicitly lists excluded products.

### TC-10: Deactivate Voucher Template
- **Actor:** Founder Admin
- **Steps:**
  1. In the templates list, locate an active template.
  2. Click **Deactivate**.
- **Expected Result:**
  - Status updates to `Inactive`.
  - Template is no longer selectable when creating new event batches.
  - Existing batches previously created from this template remain valid.

### TC-11: Reactivate Inactive Template
- **Actor:** Founder Admin
- **Steps:**
  1. Locate an inactive template.
  2. Click **Activate**.
- **Expected Result:**
  - Status returns to `Active`.
  - Template is immediately available for batch creation.

---

## Module 3: Event Batch Generation & Claim Tickets (§5 Flow 2)

### TC-12: Generate Standard Event Batch
- **Actor:** Staff / Founder
- **Steps:**
  1. Navigate to `/staff/batches`.
  2. Fill out **Generate New Voucher Batch**:
     - **Template:** Select `Midterm Study Marathon 25%`
     - **Event Name:** `BulSU Computer Studies Week 2026`
     - **Event Date:** `2026-12-01`
     - **Claim Deadline:** `2026-12-10`
     - **Batch Quantity:** `10`
     - **Max Redemptions Cap:** `5`
     - **Code Prefix:** `BULSU`
  3. Click **Generate Batch & Unique Tickets**.
- **Expected Result:**
  - Batch is created with status `Active`.
  - Exactly 10 unique tickets (`BULSU-XXXXXX`) are auto-generated.
  - Each ticket has status `Available` and a unique QR payload.

### TC-13: Validate Batch Quantity vs. Max Redemptions Cap
- **Actor:** Staff Member
- **Steps:**
  1. Attempt to create a batch with `Batch Quantity: 10` and `Max Redemptions: 15`.
- **Expected Result:**
  - Submission rejected with error: *"Max redemptions must be greater than 0 and less than or equal to batch quantity."*

### TC-14: Validate Claim Deadline vs. Event Date
- **Actor:** Staff Member
- **Steps:**
  1. Set `Event Date: 2026-12-15` and `Claim Deadline: 2026-12-01` (in the past).
- **Expected Result:**
  - Submission rejected with error: *"Claim deadline cannot be earlier than the event date."*

### TC-15: Cryptographic Claim Code Uniqueness
- **Actor:** System
- **Steps:**
  1. Generate multiple batches with the same prefix.
- **Expected Result:**
  - All claim codes are cryptographically unique (`QRCodeGenerator.generateClaimCode`).
  - No code collisions occur in the `claim_ticket` table.

### TC-16: Digital Ticket Cards Preview
- **Actor:** Staff Member
- **Steps:**
  1. In `/staff/batches`, click on any created batch in the table.
- **Expected Result:**
  - Previews generated claim tickets as physical card mockups.
  - Displays high-resolution QR codes, claim codes, event name, and claim deadline.

### TC-17: Print / Download Batch Claim Cards Sheet
- **Actor:** Staff Member
- **Steps:**
  1. Select a batch and click **🖨️ Print Batch Claim Cards**.
- **Expected Result:**
  - Opens browser print dialog.
  - Navigation bar, buttons, and shell are hidden; only the 2-column printable card sheet is formatted for clean printing/cutting.

---

## Module 4: Public Student Claim Registration (§5 Flow 3)

### TC-18: Student Registration via Claim Code URL
- **Actor:** Student Customer
- **Steps:**
  1. Open `http://localhost:3000/register/CT-YTR-003` in an incognito window.
  2. Verify event banner displays: *"Youth on the Rock Campus Gathering 2026"*.
  3. Fill in student details:
     - **Student ID:** `STU-2024-501`
     - **Full Name:** `Juan Dela Cruz`
     - **Email:** `juan.delacruz@bulsu.edu.ph`
     - **Mobile Number:** `09171234567`
     - **Data Privacy Act (RA 10173) Checkbox:** Checked.
  4. Click **Submit Voucher Claim Registration**.
- **Expected Result:**
  - Registration accepted with success confirmation.
  - Claim ticket `CT-YTR-003` transitions from `Available` to `Claimed`.
  - Private status link (`/status/[token]`) is displayed to the student.

### TC-19: Student Access via Direct Code Entry
- **Actor:** Student Customer
- **Steps:**
  1. Type or scan claim code `CT-YTR-004` on the registration page.
- **Expected Result:**
  - System resolves the claim ticket and displays the event details.

### TC-20: Data Privacy Act (RA 10173) Consent Enforcement
- **Actor:** Student Customer
- **Steps:**
  1. Fill in all registration details but leave the Data Privacy Act checkbox unchecked.
  2. Click submit.
- **Expected Result:**
  - Form blocks submission until consent is acknowledged.

### TC-21: Duplicate Student Prevention (UNIQUE(studentId, batchId))
- **Actor:** Student Customer
- **Steps:**
  1. Attempt to register for another ticket in the same batch using the same Student ID (`STU-2024-501`).
- **Expected Result:**
  - Submission rejected with clear error: *"You have already registered for a voucher in this event batch. Each student is limited to one claim per batch."*

### TC-22: Claim Deadline Expiry Lockdown
- **Actor:** Student Customer
- **Steps:**
  1. Open a claim ticket whose batch `claim_deadline` has passed.
- **Expected Result:**
  - Form is locked with notice: *"The claim deadline for this event has passed. Registrations are closed."*

### TC-23: Unguessable Status Token Link
- **Actor:** Student Customer
- **Steps:**
  1. Visit `/status/demo-token-approved-jamie-001`.
- **Expected Result:**
  - Loads registration status without exposing other students' records.
  - Status cannot be enumerated by student ID alone.

---

## Module 5: Staff Registration Review & Voucher Issuance (§5 Flow 4)

### TC-24: View Pending Registration Queue
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Navigate to `/staff/registrations`.
  2. Select the **Pending** tab.
- **Expected Result:**
  - Lists all pending claims with Student Name, Student ID, Email, Event Name, and Submitted Time.

### TC-25: Approve Registration & Issue Personal Voucher
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Locate `STU-2024-501` under the Pending tab.
  2. Click **Approve & Issue Voucher**.
- **Expected Result:**
  - Registration status updates to `Approved`.
  - Generates exactly one Personal Voucher (`PV-...`) with a unique QR code.
  - Issuing staff ID is permanently recorded.
  - Audit trail records `REGISTRATION_APPROVED`.

### TC-26: Calculation of PHT End-of-Day Expiry Date
- **Actor:** System
- **Steps:**
  1. Inspect the newly issued personal voucher.
- **Expected Result:**
  - Expiry date is calculated from `effective_duration` (e.g. 30 days) and set to **23:59:59.999 PHT (Asia/Manila)**.

### TC-27: Reject Registration with Mandatory Reason
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Under `/staff/registrations`, locate a pending registration.
  2. Enter Rejection Reason: `Ineligible student ID: ID card expired or unverified`.
  3. Click **Reject Registration**.
- **Expected Result:**
  - Registration status transitions to `Rejected`.
  - Rejection reason is saved.
  - **Zero personal vouchers or QR codes are issued (Appendix Rule).**

### TC-28: Student Status Page Live Update
- **Actor:** Student Customer
- **Steps:**
  1. Open the student's status link (`/status/[token]`) after staff approval.
- **Expected Result:**
  - Badge shows `Approved`.
  - Student's personal voucher QR code (`PV-...`) is rendered on screen with expiry date.

### TC-29: Branded Email Delivery Outbox Queuing
- **Actor:** System
- **Steps:**
  1. Inspect the `email_outbox` table after approving a registration.
- **Expected Result:**
  - Email task is queued containing Silid Malolos branding, discount percentage, expiry date, and personal QR code.

---

## Module 6: Staff Mobile & Terminal Voucher Redemption (§5 Flow 5)

### TC-30: Staff Camera QR Scan Redemption
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Open `/staff/redeem` on a mobile device or laptop with camera.
  2. Point camera at a personal voucher QR code.
- **Expected Result:**
  - Camera scans and auto-populates the voucher code field instantly.

### TC-31: Manual Code Entry Redemption
- **Actor:** Frontdesk Staff
- **Steps:**
  1. On `/staff/redeem`, type code `PV-DEMO-SEED-001`.
  2. Enter Gross Amount: `₱250.00`, Session Ref: `SESS-101`.
  3. Click **Verify & Process Redemption**.
- **Expected Result:**
  - Green success banner: *"Voucher Redeemed Successfully!"*.
  - Displays calculated discount (e.g. 20% off = ₱50.00, Net Due: ₱200.00).
  - Generates receipt text for Silid OS ledger.

### TC-32: Single-Use Guarantee (Prevent Double Redemption)
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Immediately re-scan or type the same voucher `PV-DEMO-SEED-001`.
  2. Click **Verify & Process Redemption**.
- **Expected Result:**
  - Redemption is blocked atomically.
  - Error displayed: *"This voucher has already been redeemed."*

### TC-33: Concurrency Safety via Two-Phase Locking
- **Actor:** System
- **Steps:**
  1. Two staff terminals simultaneously attempt to redeem different vouchers in a batch that has only 1 remaining redemption capacity.
- **Expected Result:**
  - Database locks `voucher_batch FOR UPDATE` then `personal_voucher FOR UPDATE`.
  - Exactly one redemption succeeds; the second is rejected with `BATCH_CAP_REACHED`.
  - Total redemptions can never exceed `max_redemptions`.

### TC-34: Enforce Batch-Wide Redemption Cap (`maxRedemptions`)
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Attempt to redeem an active voucher after the batch's `max_redemptions` cap has been reached.
- **Expected Result:**
  - Rejection with error: *"This voucher campaign has reached its maximum redemption limit."*

### TC-35: Rejection of Expired Personal Vouchers
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Attempt to redeem a voucher whose `expiry_date` is in the past.
- **Expected Result:**
  - Rejection with error: *"This voucher expired on [Date]."*

### TC-36: Rejection of Cancelled / Inactive Vouchers
- **Actor:** Frontdesk Staff
- **Steps:**
  1. Attempt to redeem a voucher with status `Cancelled`.
- **Expected Result:**
  - Rejection with error: *"This voucher has been cancelled."*

---

## Module 7: Silid OS API Integration & Fail-Open Behavior (§6)

### TC-37: Validate Voucher API (`POST /api/v1/vouchers/validate`)
- **Actor:** Silid OS System
- **Steps:**
  1. Send POST request with header `X-API-Key: sk_live_demo123` to `/api/v1/vouchers/validate`:
     ```json
     {
       "personal_qr_code": "PV-DEMO-SEED-001",
       "line_items": [
         { "productCode": "PASS_3HR", "productName": "3-Hour Pass", "quantity": 1, "unitPrice": 180 }
       ],
       "has_other_promotions": false
     }
     ```
- **Expected Result (HTTP 200):**
  - Returns `eligible: true`, `discount_percent: 20`, `discount_amount: 36.00`, `net_amount: 144.00`.

### TC-38: Strict No-Stacking Enforcement via API
- **Actor:** Silid OS System
- **Steps:**
  1. Call `/api/v1/vouchers/validate` with `"has_other_promotions": true`.
- **Expected Result (HTTP 200):**
  - Returns `eligible: false`, `reason_code: "NO_STACKING"`, message: *"Vouchers cannot be combined with other promotions."*

### TC-39: Excluded Product Filtering
- **Actor:** Silid OS System
- **Steps:**
  1. Call `/api/v1/vouchers/validate` with cart items:
     - 3-Hour Pass: ₱180 (Eligible)
     - Intensive Study Pass: ₱500 (Excluded)
- **Expected Result:**
  - Discount is applied **only** to the ₱180 pass (₱36 discount).
  - The ₱500 Intensive Pass is excluded from the discount base. Net: ₱644.

### TC-40: Active Session Hold (`POST /api/v1/vouchers/hold`)
- **Actor:** Silid OS System
- **Steps:**
  1. Call `/api/v1/vouchers/hold` with `personal_qr_code: "PV-DEMO-SEED-001"`, `session_ref: "SESS-1001"`.
- **Expected Result (HTTP 200):**
  - Voucher status transitions from `Active` to `Held`.
  - While `Held`, attempts to validate or redeem elsewhere are blocked.

### TC-41: Voided Session Release (`POST /api/v1/vouchers/release`)
- **Actor:** Silid OS System
- **Steps:**
  1. Call `/api/v1/vouchers/release` with `session_ref: "SESS-1001"`.
- **Expected Result (HTTP 200):**
  - Voucher status returns from `Held` to `Active`.
  - Batch redemption count is unaffected.

### TC-42: Silid OS Checkout Redemption (`POST /api/v1/vouchers/redeem`)
- **Actor:** Silid OS System
- **Steps:**
  1. Call `/api/v1/vouchers/redeem` at checkout payment.
- **Expected Result (HTTP 200):**
  - Executes shared atomic redemption function.
  - Returns receipt text snippet for customer thermal receipt.
  - Voucher marked `Redeemed`.

### TC-43: Idempotent Replay Protection (`idempotency_key`)
- **Actor:** Silid OS System
- **Steps:**
  1. Re-send the exact same checkout payload with the same `idempotency_key`.
- **Expected Result (HTTP 200):**
  - Returns the cached previous redemption response without re-executing or double-charging.

### TC-44: Transaction Ledger Outbox Pull (`GET /api/v1/ledger/pull`)
- **Actor:** Silid OS System
- **Steps:**
  1. Call `GET /api/v1/ledger/pull?limit=10`.
- **Expected Result (HTTP 200):**
  - Returns array of pending financial ledger events (`VOUCHER_REDEEMED`, `VOUCHER_REVERSED`, `VOUCHER_EXPIRED`).

### TC-45: Offline Reconciliation Sync (`POST /api/v1/vouchers/offline-sync`)
- **Actor:** Silid OS System
- **Steps:**
  1. Submit a batch of offline redemptions recorded during an internet outage.
- **Expected Result (HTTP 200):**
  - Returns reconciliation report showing successful syncs and rejected conflicts.

---

## Module 8: Transaction Ledger Reversals & Refunds (§6)

### TC-46: Process Ledger Reversal
- **Actor:** Founder Admin
- **Steps:**
  1. Navigate to `/staff/reports`.
  2. Locate a redeemed transaction.
  3. Click **Reverse Redemption** and enter reason: `Customer voided study session at reception`.
- **Expected Result:**
  - Status updates to `Reversed`.
  - A reversal event is queued in `ledger_outbox`.

### TC-47: Preservation of Audit Trail
- **Actor:** Auditor
- **Steps:**
  1. Inspect the `redemption` table after a reversal.
- **Expected Result:**
  - The record is **never deleted**; it has `is_reversed = true` and records the reversal reason and staff ID.

### TC-48: Voucher Restored to Active Status
- **Actor:** System
- **Steps:**
  1. Inspect the personal voucher associated with the reversed redemption.
- **Expected Result:**
  - Status returns to `Active`.
  - Customer can use their remaining study discount again.

### TC-49: Batch Redemption Counter Decrement
- **Actor:** System
- **Steps:**
  1. Inspect the batch redemption count after a reversal.
- **Expected Result:**
  - The reversed redemption is no longer counted toward the `max_redemptions` batch cap.

---

## Module 9: Business Reports & Audit Trail (§7)

### TC-50: Philippine Standard Time (PST / PHT, GMT+8) Operational Dashboard
- **Actor:** Hub Manager / Founder
- **Steps:**
  1. Open `/staff`.
- **Expected Result:**
  - Reports current date strictly adhering to Philippine Standard Time calendar dates (PHT, GMT+8).

### TC-51: Reconciled Daily Reports Screen
- **Actor:** Hub Manager
- **Steps:**
  1. Navigate to `/staff/reports`.
- **Expected Result:**
  - Displays Total Redemptions, Total Discounts Granted, and Active vs Reversed breakdown.

### TC-52: Export Matching CSV Report
- **Actor:** Hub Manager
- **Steps:**
  1. In `/staff/reports`, click **📥 Export CSV Report (Matching Screen)**.
- **Expected Result:**
  - Downloads a `.csv` file matching screen records for ledger auditing.

### TC-53: Tamper-Evident Audit Log Inspection
- **Actor:** Auditor / Founder
- **Steps:**
  1. Navigate to `/staff/audit`.
- **Expected Result:**
  - Displays chronological audit trail of all staff actions, logins, template creations, and redemptions.

### TC-54: Automatic Anomaly Detection
- **Actor:** System
- **Steps:**
  1. Perform a redemption outside business operating hours (e.g. 3:00 AM).
- **Expected Result:**
  - Audit entry is flagged with `OUTSIDE_BUSINESS_HOURS`.

---

## Module 10: Legacy Voucher CSV Import (§3, §6)

### TC-55: Upload Historical Vouchers CSV
- **Actor:** Founder Admin
- **Steps:**
  1. Navigate to `/staff/import`.
  2. Upload a sample CSV containing historical voucher records.
  3. Click **Execute Import**.
- **Expected Result:**
  - Processes CSV and displays reconciliation report.

### TC-56: Import Percentage Vouchers as Active
- **Actor:** System
- **Steps:**
  1. Verify imported percentage discount vouchers.
- **Expected Result:**
  - Created as valid, redeemable vouchers.

### TC-57: Isolation of Unsupported Types as `legacy_unsupported`
- **Actor:** System
- **Steps:**
  1. Import CSV records containing fixed-peso or free-hour vouchers.
- **Expected Result:**
  - Flagged as `legacy_unsupported`.
  - Included in reconciliation value totals.

### TC-58: Strict Guarantee: Legacy Unsupported Vouchers NEVER Redeemable
- **Actor:** Staff Member
- **Steps:**
  1. Attempt to redeem a `legacy_unsupported` voucher code in the terminal.
- **Expected Result:**
  - Redemption is blocked with error: *"Unsupported legacy voucher type."*

---

## Module 11: Administration, Security & System Settings (§7)

### TC-59: Generate SHA-256 Hashed API Key
- **Actor:** Founder Admin
- **Steps:**
  1. Navigate to `/staff/admin`.
  2. Under Silid OS API Keys, enter key name: `Silid OS Secondary Server`.
  3. Click **+ Generate New API Key**.
- **Expected Result:**
  - Generates key `sk_live_...`.
  - Only the SHA-256 hash is saved in the database.

### TC-60: API Key Rate Limiting Enforcement
- **Actor:** System
- **Steps:**
  1. Send requests exceeding the configured rate limit (e.g. 60 req/min).
- **Expected Result (HTTP 429):**
  - Blocks requests with error: *"RATE_LIMIT_EXCEEDED"*.

### TC-61: Revoke API Key
- **Actor:** Founder Admin
- **Steps:**
  1. In `/staff/admin`, click **Revoke** next to an active key.
- **Expected Result:**
  - Key is deactivated immediately; subsequent API calls with this key return HTTP 401.

### TC-62: Feature Flags Toggling
- **Actor:** Founder Admin
- **Steps:**
  1. Under `/staff/admin`, toggle feature flag `api_v1_validate` to **Disabled**.
  2. Attempt to call `/api/v1/vouchers/validate`.
- **Expected Result (HTTP 503):**
  - Returns `FEATURE_DISABLED`.

### TC-63: System Health Check Probe
- **Actor:** Uptime Monitor
- **Steps:**
  1. Send GET request to `http://localhost:3000/api/health`.
- **Expected Result (HTTP 200):**
  - Returns `{"status": "ok", "service": "silid-voucher-service", "version": "1.0.0"}`.

---

## Module 12: Scheduled Jobs & Cron Automation (§6)

### TC-64: Automatic Voucher Expiration Job
- **Actor:** Vercel Cron
- **Steps:**
  1. Trigger `GET /api/cron/expire-vouchers` with `Authorization: Bearer <CRON_SECRET>`.
- **Expected Result:**
  - Identifies active vouchers past their `expiry_date`.
  - Updates status to `Expired` and queues `VOUCHER_EXPIRED` ledger events.

### TC-65: Webhook Outbox Delivery & Retry Job
- **Actor:** Vercel Cron
- **Steps:**
  1. Trigger `GET /api/cron/process-outbox`.
- **Expected Result:**
  - Dispatches pending signed webhooks to `LEDGER_WEBHOOK_URL` with HMAC-SHA256 signature.

---

## Module 13: Interactive Companion Simulation (§6)

### TC-66: Frontdesk Check-In Simulation
- **Actor:** Tester / Evaluator
- **Steps:**
  1. Open `/staff/simulator`.
  2. Under Tab 1, click **PV-DEMO-SEED-001** and click **Step 1: Validate Voucher**.
- **Expected Result:**
  - API Inspector displays `eligible: true` with 20% discount and net calculations.

### TC-67: Session Hold Simulation
- **Actor:** Tester / Evaluator
- **Steps:**
  1. In Tab 1, click **Step 2: Start Session & Hold**.
- **Expected Result:**
  - Voucher is held; session appears under Tab 2 **Active Sessions**.

### TC-68: Active Session Release Simulation
- **Actor:** Tester / Evaluator
- **Steps:**
  1. In Tab 2, click **Void / Release Hold**.
- **Expected Result:**
  - Session is released; voucher returns to `Active`.

### TC-69: POS Checkout & Thermal Receipt Simulation
- **Actor:** Tester / Evaluator
- **Steps:**
  1. In Tab 3, click **💳 Complete Checkout & Redeem Voucher**.
- **Expected Result:**
  - Generates realistic **Silid Malolos Customer Checkout Receipt** with breakdown.

### TC-70: Ledger Event Stream Pull Simulation
- **Actor:** Tester / Evaluator
- **Steps:**
  1. In Tab 4, click **📥 Pull Ledger Events**.
- **Expected Result:**
  - Queries and displays the live event stream from `ledger_outbox`.

### TC-71: Refund & Reversal Simulation
- **Actor:** Tester / Evaluator
- **Steps:**
  1. In Tab 4, click **↩ Reverse Redemption**.
- **Expected Result:**
  - Reverses the transaction; voucher returns to `Active`.

### TC-72: Offline Batch Sync Simulation
- **Actor:** Tester / Evaluator
- **Steps:**
  1. In Tab 5, click **📡 Submit Simulated Offline Redemptions Batch**.
- **Expected Result:**
  - Processes simulated offline scans and returns reconciliation summary.

---

## 15. Traceability Matrix to System Diagrams

| Diagram # | System Diagram Name | Test Cases Covering Diagram |
|---|---|---|
| **1** | System Architecture Diagram | TC-37, TC-40, TC-41, TC-42, TC-44, TC-66 to TC-72 |
| **2** | Core Domain ERD | TC-06 to TC-09, TC-12 to TC-15, TC-21, TC-25, TC-47 |
| **3** | Student Use Case Diagram | TC-18 to TC-23 |
| **4** | Staff Use Case Diagram | TC-01 to TC-05, TC-24 to TC-36 |
| **5** | Activity 1: Manage Template | TC-06 to TC-11 |
| **6** | Activity 2: Generate Batch & Tickets | TC-12 to TC-17 |
| **7** | Activity 3: Student Registration | TC-18 to TC-23 |
| **8** | Activity 4: Review & Issue Voucher | TC-24 to TC-29 |
| **9** | Sequence 1: Template Lifecycle | TC-06, TC-10, TC-11 |
| **10** | Sequence 2: Batch & Ticket Issuance | TC-12, TC-15, TC-16, TC-17 |
| **11** | Sequence 3: Student Registration | TC-18, TC-21, TC-22, TC-23 |
| **12** | Sequence 4: Staff Review & Email | TC-24, TC-25, TC-27, TC-29 |
| **13** | Sequence 5: Atomic Voucher Redemption | TC-30, TC-31, TC-32, TC-33, TC-34 |
