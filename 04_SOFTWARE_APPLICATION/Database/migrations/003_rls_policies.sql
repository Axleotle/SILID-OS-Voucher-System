-- =============================================================================
-- Migration 003: Row Level Security Policies
-- SILID Voucher Service
-- =============================================================================
-- Depends on: 001_initial_schema.sql, 002_support_tables.sql
--
-- Design principles:
--  • auth.uid() is the Supabase Auth user ID; it must match staff.staff_id
--  • "authenticated" role = any logged-in staff member
--  • "anon" role = unauthenticated (public registration status page only)
--  • "service_role" = backend server (bypasses RLS by default in Supabase)
--  • Founder/Manager can do everything; Staff has restricted write access
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------
ALTER TABLE staff              ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_template   ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_batch      ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_ticket       ENABLE ROW LEVEL SECURITY;
ALTER TABLE student            ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration       ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_voucher   ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_outbox      ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox       ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_voucher     ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper function: resolve the calling staff member's role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_my_staff_role()
RETURNS staff_role
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM staff WHERE staff_id = auth.uid() LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Table: staff
-- ---------------------------------------------------------------------------
-- Any staff member can read the full staff table (needed for dropdowns, reviews).
CREATE POLICY "staff_read_all"
  ON staff FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update only their own row (name, etc.); Founder/Manager can update any.
CREATE POLICY "staff_update_own"
  ON staff FOR UPDATE
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR fn_my_staff_role() IN ('Founder', 'Manager')
  );

-- Only Founders can insert new staff rows (normally done via Supabase Auth trigger).
CREATE POLICY "staff_insert_founder"
  ON staff FOR INSERT
  TO authenticated
  WITH CHECK (fn_my_staff_role() = 'Founder');

-- ---------------------------------------------------------------------------
-- Table: voucher_template
-- ---------------------------------------------------------------------------
-- All authenticated staff can read templates.
CREATE POLICY "template_read_authenticated"
  ON voucher_template FOR SELECT
  TO authenticated
  USING (true);

-- Only Founder/Manager can create or modify templates.
CREATE POLICY "template_write_manager"
  ON voucher_template FOR INSERT
  TO authenticated
  WITH CHECK (fn_my_staff_role() IN ('Founder', 'Manager'));

CREATE POLICY "template_update_manager"
  ON voucher_template FOR UPDATE
  TO authenticated
  USING (fn_my_staff_role() IN ('Founder', 'Manager'));

-- ---------------------------------------------------------------------------
-- Table: voucher_batch
-- ---------------------------------------------------------------------------
-- All authenticated staff can read batches.
CREATE POLICY "batch_read_authenticated"
  ON voucher_batch FOR SELECT
  TO authenticated
  USING (true);

-- Only Founder/Manager can create batches.
CREATE POLICY "batch_insert_manager"
  ON voucher_batch FOR INSERT
  TO authenticated
  WITH CHECK (fn_my_staff_role() IN ('Founder', 'Manager'));

-- Founder/Manager can update any batch; Staff cannot.
CREATE POLICY "batch_update_manager"
  ON voucher_batch FOR UPDATE
  TO authenticated
  USING (fn_my_staff_role() IN ('Founder', 'Manager'));

-- ---------------------------------------------------------------------------
-- Table: claim_ticket
-- ---------------------------------------------------------------------------
-- All authenticated staff can read tickets.
CREATE POLICY "ticket_read_authenticated"
  ON claim_ticket FOR SELECT
  TO authenticated
  USING (true);

-- Only Founder/Manager can generate (insert) tickets.
CREATE POLICY "ticket_insert_manager"
  ON claim_ticket FOR INSERT
  TO authenticated
  WITH CHECK (fn_my_staff_role() IN ('Founder', 'Manager'));

-- Only Founder/Manager can cancel tickets.
CREATE POLICY "ticket_update_manager"
  ON claim_ticket FOR UPDATE
  TO authenticated
  USING (fn_my_staff_role() IN ('Founder', 'Manager'));

-- ---------------------------------------------------------------------------
-- Table: student
-- ---------------------------------------------------------------------------
-- All authenticated staff can read student records.
CREATE POLICY "student_read_authenticated"
  ON student FOR SELECT
  TO authenticated
  USING (true);

-- Public (anon) INSERT is needed so students can self-register via the form.
-- The application validates data before writing (service role or anon insert policy).
CREATE POLICY "student_insert_anon"
  ON student FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated staff can also insert students (admin registration).
CREATE POLICY "student_insert_staff"
  ON student FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only Founder/Manager can update student records.
CREATE POLICY "student_update_manager"
  ON student FOR UPDATE
  TO authenticated
  USING (fn_my_staff_role() IN ('Founder', 'Manager'));

-- ---------------------------------------------------------------------------
-- Table: registration
-- ---------------------------------------------------------------------------
-- All authenticated staff can read registrations.
CREATE POLICY "registration_read_authenticated"
  ON registration FOR SELECT
  TO authenticated
  USING (true);

-- Public (anon) can read ONLY their own registration via status_token.
-- The app sets app.current_status_token via SET LOCAL before the query.
CREATE POLICY "registration_read_status_token"
  ON registration FOR SELECT
  TO anon
  USING (
    status_token = current_setting('app.current_status_token', true)
  );

-- Public (anon) can submit registrations.
CREATE POLICY "registration_insert_anon"
  ON registration FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated staff can insert registrations (admin-assisted registration).
CREATE POLICY "registration_insert_staff"
  ON registration FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Any staff member can approve/reject registrations (update status).
-- Founder/Manager can additionally change batch, ticket, etc.
CREATE POLICY "registration_update_staff"
  ON registration FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    -- Staff role restricted to status updates only (enforced at app layer too)
    fn_my_staff_role() IN ('Founder', 'Manager')
    OR (
      fn_my_staff_role() = 'Staff'
      -- The following check prevents Staff from changing batch or ticket
      AND NEW.batch_id = OLD.batch_id
      AND NEW.claim_ticket_id = OLD.claim_ticket_id
      AND NEW.student_id = OLD.student_id
    )
  );

-- ---------------------------------------------------------------------------
-- Table: personal_voucher
-- ---------------------------------------------------------------------------
-- All authenticated staff can read personal vouchers.
CREATE POLICY "pv_read_authenticated"
  ON personal_voucher FOR SELECT
  TO authenticated
  USING (true);

-- Public (anon) can read a voucher linked to their registration (via status_token join).
-- Implemented via a view or at the application layer for safety.

-- Founder/Manager can issue vouchers.
CREATE POLICY "pv_insert_manager"
  ON personal_voucher FOR INSERT
  TO authenticated
  WITH CHECK (fn_my_staff_role() IN ('Founder', 'Manager'));

-- Any staff member can update voucher status (e.g., mark Expired, Cancelled).
CREATE POLICY "pv_update_staff"
  ON personal_voucher FOR UPDATE
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Table: redemption
-- ---------------------------------------------------------------------------
-- All authenticated staff can read redemptions.
CREATE POLICY "redemption_read_authenticated"
  ON redemption FOR SELECT
  TO authenticated
  USING (true);

-- Any staff member can record a redemption.
CREATE POLICY "redemption_insert_staff"
  ON redemption FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only Founder/Manager can reverse a redemption (is_reversed = true).
CREATE POLICY "redemption_update_manager"
  ON redemption FOR UPDATE
  TO authenticated
  USING (fn_my_staff_role() IN ('Founder', 'Manager'));

-- ---------------------------------------------------------------------------
-- Table: feature_flag
-- ---------------------------------------------------------------------------
-- All authenticated staff can read feature flags.
CREATE POLICY "flag_read_authenticated"
  ON feature_flag FOR SELECT
  TO authenticated
  USING (true);

-- Only Founder can toggle feature flags.
CREATE POLICY "flag_update_founder"
  ON feature_flag FOR UPDATE
  TO authenticated
  USING (fn_my_staff_role() = 'Founder');

-- service_role reads flags without RLS (Supabase default for service_role).

-- ---------------------------------------------------------------------------
-- Table: api_key
-- ---------------------------------------------------------------------------
-- api_key table is intentionally NOT readable by authenticated or anon roles.
-- Only service_role (the backend) can read it. This protects key hashes.
-- (No SELECT policy = no row is returned to anon/authenticated roles.)

-- Only Founder can manage API keys via the admin panel (which uses service_role).
-- The backend application uses the admin client (service_role) for validation.
CREATE POLICY "apikey_insert_founder"
  ON api_key FOR INSERT
  TO authenticated
  WITH CHECK (fn_my_staff_role() = 'Founder');

CREATE POLICY "apikey_update_founder"
  ON api_key FOR UPDATE
  TO authenticated
  USING (fn_my_staff_role() = 'Founder');

-- ---------------------------------------------------------------------------
-- Table: audit_log
-- ---------------------------------------------------------------------------
-- Audit log is append-only. All authenticated staff can read it.
CREATE POLICY "audit_read_manager"
  ON audit_log FOR SELECT
  TO authenticated
  USING (fn_my_staff_role() IN ('Founder', 'Manager'));

-- INSERT is done via service_role in the application (writeAuditLog helper).
-- No explicit INSERT policy for authenticated — the app always uses admin client.

-- ---------------------------------------------------------------------------
-- Table: ledger_outbox
-- ---------------------------------------------------------------------------
-- Only readable/writable by service_role (background worker + application layer).
-- No policies for authenticated or anon roles — zero access via client SDK.

-- ---------------------------------------------------------------------------
-- Table: email_outbox
-- ---------------------------------------------------------------------------
-- Same as ledger_outbox — service_role only.

-- ---------------------------------------------------------------------------
-- Table: legacy_voucher
-- ---------------------------------------------------------------------------
-- All authenticated staff can read legacy vouchers.
CREATE POLICY "legacy_read_authenticated"
  ON legacy_voucher FOR SELECT
  TO authenticated
  USING (true);

-- Only Founder/Manager can import legacy vouchers.
CREATE POLICY "legacy_insert_manager"
  ON legacy_voucher FOR INSERT
  TO authenticated
  WITH CHECK (fn_my_staff_role() IN ('Founder', 'Manager'));
