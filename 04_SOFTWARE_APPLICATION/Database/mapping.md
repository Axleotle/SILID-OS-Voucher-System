# Database Column Mapping

> Logical name → physical `snake_case` column in PostgreSQL.  
> All UUIDs are `gen_random_uuid()` defaults unless noted.

## `staff`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| staffId | staff | staff_id | UUID | PK, must match Supabase Auth uid() |
| staffName | staff | staff_name | TEXT | Full display name |
| email | staff | email | TEXT | UNIQUE; Supabase Auth login identifier |
| role | staff | role | staff_role ENUM | Founder / Manager / Staff |
| createdAt | staff | created_at | TIMESTAMPTZ | Auto-set on INSERT |
| updatedAt | staff | updated_at | TIMESTAMPTZ | Auto-updated by trigger |

## `voucher_template`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| templateId | voucher_template | template_id | UUID | PK |
| createdByStaffId | voucher_template | created_by_staff_id | UUID | FK → staff |
| templateName | voucher_template | template_name | TEXT | Human-readable label |
| benefitType | voucher_template | benefit_type | benefit_type ENUM | PERCENTAGE or LEGACY_UNSUPPORTED |
| benefitValue | voucher_template | benefit_value | NUMERIC(5,2) | 1–100; percentage points |
| effectiveDuration | voucher_template | effective_duration | INT | Days from issuance to expiry |
| restrictions | voucher_template | restrictions | TEXT | Nullable; free-text use conditions |
| excludedProducts | voucher_template | excluded_products | JSONB | Array of product names exempt from discount |
| description | voucher_template | description | TEXT | Nullable; shown on voucher detail page |
| status | voucher_template | status | TEXT | 'Active' or 'Inactive' |
| createdAt | voucher_template | created_at | TIMESTAMPTZ | Auto-set on INSERT |
| updatedAt | voucher_template | updated_at | TIMESTAMPTZ | Auto-updated by trigger |

## `voucher_batch`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| batchId | voucher_batch | batch_id | UUID | PK |
| templateId | voucher_batch | template_id | UUID | FK → voucher_template |
| createdByStaffId | voucher_batch | created_by_staff_id | UUID | FK → staff |
| eventName | voucher_batch | event_name | TEXT | Name of the event/campaign |
| eventDate | voucher_batch | event_date | DATE | Date of the event |
| claimDeadline | voucher_batch | claim_deadline | DATE | Last date to submit a registration |
| batchQuantity | voucher_batch | batch_quantity | INT | Total tickets generated for the batch |
| maxRedemptions | voucher_batch | max_redemptions | INT | Maximum vouchers that may be redeemed |
| status | voucher_batch | status | batch_status ENUM | Draft/Active/Paused/Closed/PartiallyUsed/Exhausted |
| codePrefix | voucher_batch | code_prefix | TEXT | Prefix for generated claim codes (default 'CT') |
| createdAt | voucher_batch | created_at | TIMESTAMPTZ | Auto-set on INSERT |
| updatedAt | voucher_batch | updated_at | TIMESTAMPTZ | Auto-updated by trigger |

## `claim_ticket`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| claimTicketId | claim_ticket | claim_ticket_id | UUID | PK |
| batchId | claim_ticket | batch_id | UUID | FK → voucher_batch |
| claimCode | claim_ticket | claim_code | TEXT | UNIQUE; human-readable code printed on ticket |
| qrCodeData | claim_ticket | qr_code_data | TEXT | Raw string encoded in QR image |
| status | claim_ticket | status | ticket_status ENUM | Available / Claimed / Cancelled |
| createdAt | claim_ticket | created_at | TIMESTAMPTZ | Auto-set on INSERT |

## `student`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| studentId | student | student_id | TEXT | PK; institution-assigned (e.g., STU-2024-001) |
| studentName | student | student_name | TEXT | Full name |
| email | student | email | TEXT | Contact email |
| mobileNumber | student | mobile_number | TEXT | Nullable; PH mobile number |
| silidMemberRef | student | silid_member_ref | TEXT | Nullable; cross-reference to Silid OS member record |
| createdAt | student | created_at | TIMESTAMPTZ | Auto-set on INSERT |
| updatedAt | student | updated_at | TIMESTAMPTZ | Auto-updated by trigger |

## `registration`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| registrationId | registration | registration_id | UUID | PK |
| studentId | registration | student_id | TEXT | FK → student |
| batchId | registration | batch_id | UUID | FK → voucher_batch |
| claimTicketId | registration | claim_ticket_id | UUID | FK → claim_ticket; UNIQUE; enforced same batch by trigger |
| reviewedByStaffId | registration | reviewed_by_staff_id | UUID | FK → staff; nullable until reviewed |
| submittedAt | registration | submitted_at | TIMESTAMPTZ | When the student submitted the form |
| reviewedAt | registration | reviewed_at | TIMESTAMPTZ | When a staff member approved/rejected; nullable |
| status | registration | status | registration_status ENUM | Pending / Approved / Rejected |
| rejectionReason | registration | rejection_reason | TEXT | Nullable; required when status = Rejected |
| statusToken | registration | status_token | TEXT | UNIQUE; 48-char hex token for anonymous status lookup |

## `personal_voucher`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| personalVoucherId | personal_voucher | personal_voucher_id | UUID | PK |
| registrationId | personal_voucher | registration_id | UUID | FK → registration; UNIQUE (1:1) |
| issuedByStaffId | personal_voucher | issued_by_staff_id | UUID | FK → staff; nullable if auto-issued |
| personalQrCode | personal_voucher | personal_qr_code | TEXT | UNIQUE; raw QR string for checkout scanning |
| issuedAt | personal_voucher | issued_at | TIMESTAMPTZ | When the voucher was issued |
| expiryDate | personal_voucher | expiry_date | TIMESTAMPTZ | UTC; = issuedAt + effectiveDuration days (end-of-day PHT) |
| status | personal_voucher | status | voucher_status ENUM | Active / Redeemed / Expired / Cancelled |

## `redemption`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| redemptionId | redemption | redemption_id | UUID | PK |
| personalVoucherId | redemption | personal_voucher_id | UUID | FK → personal_voucher |
| processedByStaffId | redemption | processed_by_staff_id | UUID | FK → staff; nullable for API-originated redemptions |
| redeemedAt | redemption | redeemed_at | TIMESTAMPTZ | When the checkout occurred |
| isReversed | redemption | is_reversed | BOOLEAN | FALSE until a reversal is applied |
| reversedAt | redemption | reversed_at | TIMESTAMPTZ | Nullable; set on reversal |
| reversedByStaffId | redemption | reversed_by_staff_id | UUID | FK → staff; who authorised the reversal |
| reversalReason | redemption | reversal_reason | TEXT | Mandatory justification for reversal |
| source | redemption | source | source_type ENUM | staff_ui / api_v1 / offline_sync |
| sessionRef | redemption | session_ref | TEXT | Nullable; Silid OS checkout session ID |
| idempotencyKey | redemption | idempotency_key | TEXT | Nullable; caller-supplied dedup key |
| grossAmount | redemption | gross_amount | NUMERIC(12,2) | Nullable; basket total before discount (PHP) |
| discountAmount | redemption | discount_amount | NUMERIC(12,2) | Nullable; PHP amount saved |
| netAmount | redemption | net_amount | NUMERIC(12,2) | Nullable; amount student pays |

## `feature_flag`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| flagId | feature_flag | flag_id | UUID | PK |
| flagKey | feature_flag | flag_key | TEXT | UNIQUE; e.g., api_v1_validate |
| isEnabled | feature_flag | is_enabled | BOOLEAN | FALSE = feature off |
| description | feature_flag | description | TEXT | Nullable; human description |
| updatedByStaffId | feature_flag | updated_by_staff_id | UUID | FK → staff; who last toggled it |
| updatedAt | feature_flag | updated_at | TIMESTAMPTZ | Auto-set on change |

## `api_key`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| apiKeyId | api_key | api_key_id | UUID | PK |
| keyName | api_key | key_name | TEXT | Descriptive label (e.g., "Silid OS Prod") |
| keyHash | api_key | key_hash | TEXT | UNIQUE; SHA-256 or bcrypt hash of raw key |
| createdByStaffId | api_key | created_by_staff_id | UUID | FK → staff |
| isActive | api_key | is_active | BOOLEAN | FALSE = revoked |
| rateLimitPerMinute | api_key | rate_limit_per_minute | INT | Requests/min quota |
| createdAt | api_key | created_at | TIMESTAMPTZ | Auto-set on INSERT |
| lastUsedAt | api_key | last_used_at | TIMESTAMPTZ | Updated on each authenticated request |

## `audit_log`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| auditId | audit_log | audit_id | UUID | PK |
| actorStaffId | audit_log | actor_staff_id | UUID | Nullable; who performed the action |
| actorRole | audit_log | actor_role | TEXT | Denormalised role snapshot at time of action |
| action | audit_log | action | TEXT | Verb (e.g., REGISTRATION_APPROVED) |
| entityType | audit_log | entity_type | TEXT | Table name (e.g., registration) |
| entityId | audit_log | entity_id | TEXT | UUID/TEXT of affected row |
| beforeValue | audit_log | before_value | JSONB | Nullable; row state before mutation |
| afterValue | audit_log | after_value | JSONB | Nullable; row state after mutation |
| reason | audit_log | reason | TEXT | Nullable; staff-entered justification |
| ipAddress | audit_log | ip_address | TEXT | Nullable; request IP |
| userAgent | audit_log | user_agent | TEXT | Nullable; browser/client UA |
| anomalyFlags | audit_log | anomaly_flags | TEXT[] | Auto-detected flags (e.g., OUTSIDE_BUSINESS_HOURS) |
| createdAt | audit_log | created_at | TIMESTAMPTZ | Immutable; when the event was recorded |

## `ledger_outbox`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| outboxId | ledger_outbox | outbox_id | UUID | PK |
| eventType | ledger_outbox | event_type | TEXT | Ledger event name |
| payload | ledger_outbox | payload | JSONB | Full event payload to send |
| status | ledger_outbox | status | TEXT | pending / sent / failed |
| attempts | ledger_outbox | attempts | INT | Delivery attempt count |
| lastAttemptedAt | ledger_outbox | last_attempted_at | TIMESTAMPTZ | Nullable |
| sentAt | ledger_outbox | sent_at | TIMESTAMPTZ | Nullable; when successfully delivered |
| createdAt | ledger_outbox | created_at | TIMESTAMPTZ | Auto-set on INSERT |
| errorMessage | ledger_outbox | error_message | TEXT | Nullable; last delivery error |

## `email_outbox`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| emailId | email_outbox | email_id | UUID | PK |
| toEmail | email_outbox | to_email | TEXT | Recipient address |
| subject | email_outbox | subject | TEXT | Email subject line |
| htmlBody | email_outbox | html_body | TEXT | Full HTML email content |
| relatedEntityType | email_outbox | related_entity_type | TEXT | Nullable; entity that triggered the email |
| relatedEntityId | email_outbox | related_entity_id | TEXT | Nullable; PK of related entity |
| status | email_outbox | status | TEXT | pending / sent / failed |
| attempts | email_outbox | attempts | INT | Send attempt count |
| lastAttemptedAt | email_outbox | last_attempted_at | TIMESTAMPTZ | Nullable |
| sentAt | email_outbox | sent_at | TIMESTAMPTZ | Nullable; when successfully sent |
| createdAt | email_outbox | created_at | TIMESTAMPTZ | Auto-set on INSERT |
| errorMessage | email_outbox | error_message | TEXT | Nullable; last send error |
| providerMessageId | email_outbox | provider_message_id | TEXT | Nullable; Resend/SendGrid message ID |

## `legacy_voucher`

| Logical Name | Table | Physical Column | Type | Notes |
|---|---|---|---|---|
| legacyId | legacy_voucher | legacy_id | UUID | PK |
| originalCode | legacy_voucher | original_code | TEXT | Code as it appeared in legacy system |
| originalType | legacy_voucher | original_type | TEXT | Legacy benefit type string |
| originalData | legacy_voucher | original_data | JSONB | Full raw legacy record |
| importBatch | legacy_voucher | import_batch | TEXT | Import run label (e.g., IMPORT-2024-Q1) |
| importedAt | legacy_voucher | imported_at | TIMESTAMPTZ | Auto-set on INSERT |
| importedByStaffId | legacy_voucher | imported_by_staff_id | UUID | FK → staff; nullable |
| notes | legacy_voucher | notes | TEXT | Nullable; importer comments |
