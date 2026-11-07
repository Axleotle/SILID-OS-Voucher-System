# Database Extensions Beyond Core ERD

This document explains every field, table, index, and behaviour that goes **beyond** the core entity-relationship diagram specified in the SILID Voucher Service project brief. For each extension, the rationale, source requirement, and diagram-compliance confirmation are provided.

---

## 1. `student.silid_member_ref` (TEXT, nullable)

| Attribute | Detail |
|---|---|
| **What it adds** | An optional cross-reference linking a student record to their account in the existing Silid OS system. |
| **Why added** | Phase 3 (Silid OS integration) requires the ability to look up a student's membership tier, purchase history, and loyalty points. Without this field, the join would require a full name + email fuzzy match, which is unreliable. |
| **Brief section** | §6 Integration — "Silid OS API integration for checkout" |
| **Diagram impact** | The core diagram shows `student` with `student_id`, `name`, `email`. This adds a nullable column; no existing constraint is weakened. |

---

## 2. `redemption.source` (source_type ENUM)

| Attribute | Detail |
|---|---|
| **What it adds** | Tracks *which channel* processed a redemption: `staff_ui`, `api_v1`, or `offline_sync`. |
| **Why added** | The brief describes three redemption paths. Audit and anomaly detection (§7) need to distinguish API-driven redemptions from staff-UI and offline events. |
| **Brief section** | §5 Redemption flows, §7 Audit & Anomaly Detection |
| **Diagram impact** | Adds a column to `redemption`; does not remove or weaken any existing field or constraint. |

---

## 3. `redemption.session_ref` (TEXT, nullable)

| Attribute | Detail |
|---|---|
| **What it adds** | An optional reference to the external Silid OS checkout session that triggered the redemption. |
| **Why added** | The Silid OS API integration uses a session-based checkout model (start-session → hold → checkout). The session ID must be stored for reconciliation and reversal audits. |
| **Brief section** | §6 Silid OS API — session lifecycle |
| **Diagram impact** | Nullable column addition only; no existing constraint affected. |

---

## 4. `redemption.idempotency_key` (TEXT, nullable) + partial unique index

| Attribute | Detail |
|---|---|
| **What it adds** | An optional caller-supplied deduplication key with a partial unique index (`WHERE idempotency_key IS NOT NULL`). |
| **Why added** | Network retries can cause duplicate redemption inserts. The idempotency key (supplied by Silid OS) ensures `at-most-once` semantics: a second request with the same key returns the existing redemption rather than creating a new one. |
| **Brief section** | §6 Reliability requirements for the Silid OS API |
| **Diagram impact** | Adds column + partial index. NULL rows are excluded from the uniqueness constraint (Postgres standard behaviour). Does not change any existing column. |

---

## 5. `redemption.gross_amount`, `redemption.discount_amount`, `redemption.net_amount` (NUMERIC(12,2), nullable)

| Attribute | Detail |
|---|---|
| **What it adds** | Captures the basket value and computed discount at the moment of redemption for financial reporting. |
| **Why added** | The brief's pricing strategy (§4) requires the system to calculate and record the actual PHP discount applied. These fields support ledger event payloads and the reporting dashboard. |
| **Brief section** | §4 Pricing Strategy, §8 Reporting |
| **Diagram impact** | All three are nullable (redemptions via `offline_sync` may not have basket data). No existing field is changed. |

---

## 6. `voucher_template.excluded_products` (JSONB, default `["Intensive Pass","Hub Reservations"]`)

| Attribute | Detail |
|---|---|
| **What it adds** | A per-template list of product names or codes that are exempt from the discount calculation. |
| **Why added** | The brief explicitly states that certain high-margin products (Intensive Pass, Hub Reservations) must never receive a voucher discount. Storing this as JSONB on the template makes the exclusion list configurable per template without a schema change. |
| **Brief section** | §4 Pricing Strategy — exclusions |
| **Diagram impact** | Adds a JSONB column with a sensible default. The core ERD did not model exclusions; this fills a mandatory gap. |

---

## 7. `registration.status_token` (TEXT, UNIQUE, default 48-hex-char random)

| Attribute | Detail |
|---|---|
| **What it adds** | An unguessable token embedded in a URL so students can check their registration status without creating an account. |
| **Why added** | The public-facing registration flow (§3) must allow students to check their status without authentication. Using the UUID `registration_id` alone would be guessable by enumeration. The 48-hex-char token (192 bits of entropy) is cryptographically unguessable. |
| **Brief section** | §3 Registration & Approval Flow — student status page |
| **Diagram impact** | Adds a column; does not modify any existing constraint. |

---

## 8. `voucher_batch.code_prefix` (TEXT, default `'CT'`)

| Attribute | Detail |
|---|---|
| **What it adds** | A configurable prefix prepended to generated claim codes (e.g., `CT` → `CT-YTR2026-001`). |
| **Why added** | Different events may want different code namespaces (e.g., `HUB`, `EVT`, `LOY`) so tickets are visually distinguishable. |
| **Brief section** | §2 Batch Generation |
| **Diagram impact** | Adds a nullable column with a default. No constraint weakened. |

---

## 9. Partial Unique Index on `redemption(personal_voucher_id) WHERE NOT is_reversed`

| Attribute | Detail |
|---|---|
| **What it adds** | Enforces that only **one active (non-reversed) redemption** may exist per voucher at any time. A reversed redemption is excluded so the voucher can be re-redeemed. |
| **Why added** | Standard unique indexes would prevent re-redemption after a legitimate reversal (e.g., cashier error). The partial index precisely models the business rule: "a voucher may only be redeemed once at a time, but a reversed redemption unlocks the slot." |
| **Brief section** | §5 Reversal — "reversal restores voucher to redeemable state" |
| **Diagram impact** | This is a **deviation from a naïve unique FK** but does **not** weaken the one-redemption-per-voucher rule — it refines it to allow the reversal workflow the brief requires. |

---

## 10. `redemption.is_reversed`, `reversed_at`, `reversed_by_staff_id`, `reversal_reason`

| Attribute | Detail |
|---|---|
| **What it adds** | Marks a redemption row as reversed (soft-delete pattern), records when and by whom, and captures the mandatory justification. |
| **Why added** | The brief §5 requires cashier-error reversal support. Deleting the row would destroy the audit trail; instead the row is kept and flagged. |
| **Brief section** | §5 Reversal workflow |
| **Diagram impact** | Extends the `redemption` table. No existing field or rule is removed or relaxed. |

---

## 11. `feature_flag` Table

| Attribute | Detail |
|---|---|
| **What it adds** | A database-backed runtime toggle store for all API endpoints and optional features. |
| **Why added** | The Silid OS API integration endpoints (validate, hold, redeem, reverse, etc.) must be individually toggleable without a deployment. The brief §6 requires a phased rollout. |
| **Brief section** | §6 Integration — phased API rollout |
| **Diagram impact** | New support table. Does not alter any core entity. |

---

## 12. `api_key` Table

| Attribute | Detail |
|---|---|
| **What it adds** | Stores hashed API keys issued to Silid OS and other authorised machine callers. |
| **Why added** | The brief §6 requires the voucher service to authenticate inbound API requests from Silid OS. Keys are stored as hashes (never raw) for security. Rate limiting is enforced per key. |
| **Brief section** | §6 Security — machine-to-machine authentication |
| **Diagram impact** | New support table. Does not alter any core entity. |

---

## 13. `audit_log` Table

| Attribute | Detail |
|---|---|
| **What it adds** | An append-only log of every significant action (approval, rejection, redemption, reversal, flag toggle, etc.). |
| **Why added** | The brief §7 requires a full audit trail for compliance and anomaly detection. Storing in a separate table (not in the main rows) prevents tampering via UPDATE/DELETE on the source tables. |
| **Brief section** | §7 Audit & Anomaly Detection |
| **Diagram impact** | New support table. Does not alter any core entity. |

---

## 14. `audit_log.anomaly_flags` (TEXT[], default `{}`)

| Attribute | Detail |
|---|---|
| **What it adds** | An array of machine-detected anomaly tags on each audit entry (e.g., `OUTSIDE_BUSINESS_HOURS`, `BATCH_NEAR_CAP`). |
| **Why added** | The brief §7 requires the system to flag unusual patterns for manual review. Storing flags on the audit row enables dashboard filtering without a separate anomaly table. |
| **Brief section** | §7 Anomaly Detection |
| **Diagram impact** | Column added to `audit_log` only. |

---

## 15. `ledger_outbox` Table

| Attribute | Detail |
|---|---|
| **What it adds** | A transactional outbox for Silid OS ledger webhook events, implementing the outbox pattern for reliable at-least-once delivery. |
| **Why added** | The brief §6 requires the voucher service to push redemption events to Silid OS's ledger. The outbox pattern ensures events are not lost if the HTTP call fails: the row is inserted in the same transaction as the redemption, and a background worker delivers it with retries. |
| **Brief section** | §6 Ledger Integration |
| **Diagram impact** | New support table. |

---

## 16. `email_outbox` Table

| Attribute | Detail |
|---|---|
| **What it adds** | A transactional outbox for all outbound emails (approval notification, rejection, voucher delivery). |
| **Why added** | Same reliability argument as `ledger_outbox`. Emails must not be lost on transient SMTP/provider failures. The feature is gated by the `email_delivery` feature flag. |
| **Brief section** | §3 Registration Flow — email notifications |
| **Diagram impact** | New support table. |

---

## 17. `legacy_voucher` Table

| Attribute | Detail |
|---|---|
| **What it adds** | A read-only archive table for importing vouchers from pre-system sources (paper records, spreadsheets, prior apps). |
| **Why added** | The brief §9 mentions legacy voucher migration. These records cannot be repriced (the original discount logic is unknown), so they are stored as `LEGACY_UNSUPPORTED` and kept for historical reference only. They are not redeemable via the API. |
| **Brief section** | §9 Legacy Migration |
| **Diagram impact** | New support table. The `benefit_type` ENUM includes `LEGACY_UNSUPPORTED` specifically for this. |

---

## 18. `batch_status.PartiallyUsed` (ENUM value extension)

| Attribute | Detail |
|---|---|
| **What it adds** | An intermediate batch status between `Active` (zero redemptions) and `Exhausted` (all slots used). |
| **Why added** | The operations dashboard (§8) needs to show at a glance how much of a batch has been consumed. Without `PartiallyUsed`, staff cannot distinguish a batch with zero redemptions from one with 50%. |
| **Brief section** | §8 Dashboard / Reporting |
| **Diagram impact** | Adds a value to the `batch_status` ENUM. The diagram showed Draft/Active/Paused/Closed/Exhausted; `PartiallyUsed` is inserted between Active and Exhausted and does **not** remove or redefine any existing state. |
