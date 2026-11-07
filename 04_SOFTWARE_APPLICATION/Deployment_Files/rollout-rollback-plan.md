# Staged Rollout and Rollback Plan

This plan outlines the zero-downtime, staged rollout of the standalone SILID Voucher Service into Silid OS production, controlled by database feature flags (§2, §6).

---

## 1. Feature Flag Inventory

All flags reside in the `feature_flag` table and can be toggled via the Staff Admin UI (`/staff/admin`) or directly in SQL without redeploying code.

| Flag Key | Scope | Default | Description |
|---|---|---|---|
| `api_v1_validate` | Validate Endpoint | `false` | Enables validation queries from Silid OS |
| `api_v1_hold` | Session Hold/Release | `false` | Enables voucher reservation for open sessions |
| `api_v1_redeem` | Checkout Redemption | `false` | Enables atomic redemption at Checkout |
| `api_v1_reverse` | Reversal Endpoint | `false` | Enables manager refunds/reversals |
| `api_v1_ledger_events` | Ledger Pull | `false` | Enables ledger sync polling |
| `email_delivery` | Email Dispatch | `false` | Enables student notification emails |
| `api_v1_start_session` | Integration Checkpoint | `false` | Silid OS Start Session hook |
| `api_v1_active_sessions`| Integration Checkpoint | `false` | Silid OS Active Sessions hook |
| `api_v1_checkout` | Integration Checkpoint | `false` | Silid OS Checkout hook |

---

## 2. Staged Rollout Sequence (Phase 1 to Phase 4)

### Phase 1: Internal Staff Verification (Day 1)
- Deploy Next.js to Vercel and run database migrations in Supabase.
- Keep all API flags `false`.
- Staff logs in, creates a template, generates a test batch of 10 tickets, and prints claim cards.
- Test student registration page (`/register/CT-...`) and status page (`/status/...`).
- Approve registration in staff UI and verify personal QR is issued.

### Phase 2: Read-Only Validation Integration (Day 2)
- Enable `api_v1_validate` and `api_v1_start_session`.
- Silid OS starts calling `validate` upon voucher scan at Start Session.
- Disallow redemptions yet; observe error rates, latency (must be &lt; 2s), and rate limiting.

### Phase 3: Checkout Redemption & Ledger Sync (Day 3)
- Enable `api_v1_redeem`, `api_v1_hold`, `api_v1_reverse`, and `api_v1_ledger_events`.
- Silid OS begins processing live redemptions at Checkout.
- Reconcile redemption totals with Silid OS Transaction Ledger end-of-day.

### Phase 4: Full Automation & Outbound Email (Day 4)
- Enable `email_delivery`.
- Approved student registrations now trigger automated Silid-branded email delivery.

---

## 3. Rollback Procedures

If an anomaly, regression, or database contention issue is observed:

### Instant Soft Rollback (No Redeploy Required):
1. Navigate to `/staff/admin` in the Voucher Service.
2. Toggle the affected feature flag to **Disabled** (e.g. `api_v1_redeem` -> `false`).
3. Silid OS receives HTTP 503 `FEATURE_DISABLED` and immediately triggers its **Fail-Open** mechanism: customer transaction proceeds normally without blocking checkout.

### Hard Emergency Rollback (SQL Command):
If the web UI is unreachable, run directly in Supabase SQL Editor:
```sql
UPDATE feature_flag SET is_enabled = false WHERE flag_key LIKE 'api_v1_%';
```
All API endpoints immediately return fail-safe responses.
