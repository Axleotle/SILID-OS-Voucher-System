# SILID Voucher Service — Entity Relationship Diagram (ERD)

This diagram documents the complete relational model of the SILID Voucher Service, highlighting both the core authoritative entities from `reference/SiliD_Complete_System_Diagrams.pdf` and the integration extensions detailed in `Database/EXTENSIONS.md`.

```mermaid
erDiagram
    STAFF ||--o{ VOUCHER_TEMPLATE : creates
    STAFF ||--o{ VOUCHER_BATCH : generates
    STAFF ||--o{ REGISTRATION : reviews
    STAFF ||--o{ PERSONAL_VOUCHER : issues
    STAFF ||--o{ REDEMPTION : processes
    STAFF ||--o{ REDEMPTION : reverses

    VOUCHER_TEMPLATE ||--o{ VOUCHER_BATCH : defines
    VOUCHER_BATCH ||--|{ CLAIM_TICKET : contains
    VOUCHER_BATCH ||--o{ REGISTRATION : targets

    STUDENT ||--o{ REGISTRATION : submits
    CLAIM_TICKET ||--|| REGISTRATION : claims

    REGISTRATION ||--o| PERSONAL_VOUCHER : generates
    PERSONAL_VOUCHER ||--o{ REDEMPTION : redeems

    STAFF {
        uuid staff_id PK
        string staff_name
        string email UK
        enum role "Founder | Manager | Staff"
        timestamptz created_at
        timestamptz updated_at
    }

    VOUCHER_TEMPLATE {
        uuid template_id PK
        uuid created_by_staff_id FK
        string template_name
        enum benefit_type "PERCENTAGE | LEGACY_UNSUPPORTED"
        numeric benefit_value "1..100"
        int effective_duration "Days"
        string restrictions
        jsonb excluded_products "EXT: ['Intensive Pass', 'Hub Reservations']"
        string description
        string status "Active | Inactive"
        timestamptz created_at
        timestamptz updated_at
    }

    VOUCHER_BATCH {
        uuid batch_id PK
        uuid template_id FK
        uuid created_by_staff_id FK
        string event_name
        date event_date
        date claim_deadline
        int batch_quantity
        int max_redemptions "Batch-wide redemption cap"
        enum status "Draft | Active | Paused | Closed | PartiallyUsed | Exhausted"
        string code_prefix "EXT: e.g. CT-YTR"
        timestamptz created_at
        timestamptz updated_at
    }

    CLAIM_TICKET {
        uuid claim_ticket_id PK
        uuid batch_id FK
        string claim_code UK
        string qr_code_data
        enum status "Available | Claimed | Cancelled"
        timestamptz created_at
    }

    STUDENT {
        string student_id PK
        string student_name
        string email
        string mobile_number
        string silid_member_ref "EXT: Silid OS member reference"
        timestamptz created_at
        timestamptz updated_at
    }

    REGISTRATION {
        uuid registration_id PK
        string student_id FK
        uuid batch_id FK
        uuid claim_ticket_id FK,UK "UNIQUE(student_id, batch_id)"
        uuid reviewed_by_staff_id FK
        timestamptz submitted_at
        timestamptz reviewed_at
        enum status "Pending | Approved | Rejected"
        string rejection_reason
        string status_token UK "EXT: 48-char unguessable status token"
    }

    PERSONAL_VOUCHER {
        uuid personal_voucher_id PK
        uuid registration_id FK,UK "1:1 with Approved Registration"
        uuid issued_by_staff_id FK
        string personal_qr_code UK
        timestamptz issued_at
        timestamptz expiry_date "Calculated: end of day PHT"
        enum status "Active | Held | Redeemed | Expired | Cancelled"
    }

    REDEMPTION {
        uuid redemption_id PK
        uuid personal_voucher_id FK "Partial UK: 1 active per voucher"
        uuid processed_by_staff_id FK
        timestamptz redeemed_at
        boolean is_reversed "EXT: Reversal flag"
        timestamptz reversed_at "EXT"
        uuid reversed_by_staff_id FK "EXT"
        string reversal_reason "EXT"
        enum source "staff_ui | api_v1 | offline_sync"
        string session_ref "EXT: Silid OS session ID"
        string idempotency_key UK "EXT: Idempotent replay key"
        numeric gross_amount "EXT"
        numeric discount_amount "EXT"
        numeric net_amount "EXT"
    }

    FEATURE_FLAG {
        uuid flag_id PK
        string flag_key UK
        boolean is_enabled
        string description
        timestamptz updated_at
    }

    API_KEY {
        uuid api_key_id PK
        string key_name
        string key_hash UK "SHA-256 hash"
        boolean is_active
        int rate_limit_per_minute
        timestamptz created_at
        timestamptz last_used_at
    }

    AUDIT_LOG {
        uuid audit_id PK
        uuid actor_staff_id
        string actor_role
        string action
        string entity_type
        string entity_id
        jsonb before_value
        jsonb after_value
        string reason
        string[] anomaly_flags "e.g. OUTSIDE_BUSINESS_HOURS"
        timestamptz created_at
    }

    LEDGER_OUTBOX {
        uuid outbox_id PK
        string event_type
        jsonb payload
        string status "pending | sent | failed"
        int attempts
        timestamptz sent_at
        timestamptz created_at
    }

    EMAIL_OUTBOX {
        uuid email_id PK
        string to_email
        string subject
        string html_body
        string status "pending | sent | failed"
        int attempts
        timestamptz sent_at
        timestamptz created_at
    }

    LEGACY_VOUCHER {
        uuid legacy_id PK
        string original_code
        string original_type "PERCENTAGE | LEGACY_UNSUPPORTED"
        jsonb original_data
        string import_batch
        timestamptz imported_at
    }
```

---

## Core Invariants & Rules Enforced in Database:
1. `UNIQUE(student_id, batch_id)` on `registration`: Prevents a student from claiming more than 1 ticket per event.
2. `Registration.claimTicketId` is unique and checked via trigger `trg_check_ticket_batch` to ensure `claim_ticket.batch_id == registration.batch_id`.
3. Only an `Approved` registration may have a personal voucher (enforced in application logic & foreign key relationship).
4. Partial unique index on `redemption(personal_voucher_id) WHERE NOT is_reversed`: Enforces single-use while allowing reversals to restore voucher to Active.
5. Atomic redemption with dual locking: `voucher_batch FOR UPDATE` then `personal_voucher FOR UPDATE` prevents concurrent cap exceedance across vouchers.
