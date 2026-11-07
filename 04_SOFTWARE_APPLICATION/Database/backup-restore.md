# Database Backup & Disaster Recovery Procedure

This document details the standardized backup, export, and point-in-time restore procedures for the SILID Voucher Service standalone Supabase PostgreSQL database.

---

## 1. Automated Backups (Supabase Hosted)

When deployed on Supabase Pro / Team tier:
- **Daily Automated Backups:** Backups run daily at 00:00 UTC (08:00 AM PHT). Backups are stored in encrypted multi-region S3 storage with 7 to 30 days retention.
- **Point-In-Time Recovery (PITR):** Enables restoration to any second within the retention window by replaying WAL logs.

---

## 2. Manual Backup (pg_dump)

For local development or pre-migration snapshots, perform a schema and data dump using `pg_dump`:

### A. Full Backup (Schema + Data)
```bash
# Set your connection URI (from Supabase dashboard -> Project Settings -> Database)
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Run pg_dump in custom compressed format
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="silid_voucher_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### B. Plain SQL Data-Only Backup (Audit Reconciliation)
```bash
pg_dump "$DATABASE_URL" \
  --data-only \
  --table=public.redemption \
  --table=public.personal_voucher \
  --table=public.registration \
  --table=public.audit_log \
  --file="silid_voucher_audit_data_$(date +%Y%m%d).sql"
```

---

## 3. Restore Procedure

### A. Restoring to Local Supabase or Staging Instance
```bash
# 1. Start local Supabase instance
supabase start

# 2. Reset database to fresh schema
supabase db reset

# 3. Restore from custom dump
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -d "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  silid_voucher_backup_YYYYMMDD_HHMMSS.dump
```

### B. Disaster Recovery Verification Checklist
1. Verify foreign key and uniqueness integrity:
   ```sql
   -- Check for orphan personal vouchers:
   SELECT COUNT(*) FROM personal_voucher pv
   LEFT JOIN registration r ON r.registration_id = pv.registration_id
   WHERE r.registration_id IS NULL;
   -- Expected: 0

   -- Check for multiple active redemptions on single voucher:
   SELECT personal_voucher_id, COUNT(*)
   FROM redemption
   WHERE NOT is_reversed
   GROUP BY personal_voucher_id
   HAVING COUNT(*) > 1;
   -- Expected: 0
   ```
2. Verify batch cap consistency:
   ```sql
   SELECT b.batch_id, b.max_redemptions, COUNT(r.redemption_id) AS actual_redeemed
   FROM voucher_batch b
   LEFT JOIN registration reg ON reg.batch_id = b.batch_id
   LEFT JOIN personal_voucher pv ON pv.registration_id = reg.registration_id
   LEFT JOIN redemption r ON r.personal_voucher_id = pv.personal_voucher_id AND NOT r.is_reversed
   GROUP BY b.batch_id, b.max_redemptions
   HAVING COUNT(r.redemption_id) > b.max_redemptions;
   -- Expected: 0 rows (no batch ever exceeds cap)
   ```
3. Test API key hashes and feature flags:
   ```sql
   SELECT flag_key, is_enabled FROM feature_flag;
   SELECT key_name, is_active FROM api_key;
   ```
