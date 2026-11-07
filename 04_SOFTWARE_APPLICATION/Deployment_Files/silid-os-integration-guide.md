# Silid OS Developer Integration Guide

This guide describes how the Silid OS engineering team integrates with the standalone SILID Voucher Service.

---

## 1. High-Level Principles & Architecture

- **Separate Database & Isolation:** Silid OS never touches our Postgres database. Communication occurs strictly over HTTPS through `/api/v1/...`.
- **Fail-Open Strategy (§2):** If the Voucher Service is unreachable (timeout > 2 seconds or HTTP 5xx), Silid OS **must fail open**: allow the customer's session or checkout to proceed without failing, log an offline voucher scan, and sync later.
- **Single Source of Truth:** Only one service is authoritative for a voucher at any given time (tracked by the `source` field).
- **No Promotion Stacking (§3):** Vouchers can never stack with any other promo or discount. If another promotion is selected, Silid OS must pass `has_other_promotions: true`, which immediately rejects the voucher.

---

## 2. Integration Points in Silid OS

### A. Start Session / Check-In (Validate or Hold)
When a member arrives and scans a personal voucher QR code:
1. Call `POST /api/v1/vouchers/validate`
   ```json
   {
     "personal_qr_code": "PV-4A9B2C...",
     "member_ref": "MEM-1082",
     "has_other_promotions": false
   }
   ```
2. If session starts, optionally call `POST /api/v1/vouchers/hold` with `session_ref: "SES-..."` to reserve the voucher for the open session.
3. If the session is voided or cancelled before completion, call `POST /api/v1/vouchers/release` to release the hold.

### B. Checkout (Atomic Redemption)
At Checkout, calculate line items and call:
`POST /api/v1/vouchers/redeem`
```json
{
  "personal_qr_code": "PV-4A9B2C...",
  "session_ref": "SES-1082",
  "idempotency_key": "silid-checkout-sess-1082",
  "has_other_promotions": false,
  "line_items": [
    {
      "productCode": "FP_DAILY",
      "productName": "Daily Focus Pass",
      "quantity": 1,
      "unitPrice": 180.00
    },
    {
      "productCode": "PASS_INTENSIVE",
      "productName": "Intensive Pass",
      "quantity": 1,
      "unitPrice": 420.00
    }
  ]
}
```
**Response:**
```json
{
  "success": true,
  "redemption_id": "8fa8...-...",
  "receipt_text": "Voucher: PV-4A9B2C... | Discount: 20% (₱36.00 off) | Net: ₱564.00",
  "gross_amount": 600.00,
  "discount_amount": 36.00,
  "net_amount": 564.00
}
```
*Note: Intensive Pass was excluded from the 20% discount as defined in the template.*

### C. Session Void / Refund Reversal
If a completed transaction is voided or refunded, call:
`POST /api/v1/vouchers/reverse`
```json
{
  "redemption_id": "8fa8...-...",
  "reversal_reason": "Customer changed mind / session refunded in Silid OS"
}
```
*Effect: Restores voucher to Active status and deducts 1 from the campaign redemption cap.*

---

## 3. Offline Mode & Replay Reconciliation (§2)

If the voucher service is unreachable:
1. Silid OS records the redemption locally with an `idempotency_key` (e.g. `offline-SES-1082`).
2. When connectivity resumes, submit offline events to:
   `POST /api/v1/vouchers/offline-sync`
   ```json
   {
     "entries": [
       {
         "personal_qr_code": "PV-4A9B2C...",
         "idempotency_key": "offline-SES-1082",
         "session_ref": "SES-1082"
       }
     ]
   }
   ```
3. The endpoint returns a reconciliation breakdown. Any duplicate submissions are safely deduplicated by the idempotency key.

---

## 4. Ledger Webhook & Pull API (§6)

- **Webhook:** The Voucher Service emits `VOUCHER_REDEEMED`, `REDEMPTION_REVERSED`, and `VOUCHER_EXPIRED` events to `LEDGER_WEBHOOK_URL` signed with `X-Silid-Signature` (HMAC-SHA256).
- **Pull Fallback:** Silid OS can poll `GET /api/v1/ledger/pull?since=ISO_TIMESTAMP` to pull audited events directly for reconciliation.
