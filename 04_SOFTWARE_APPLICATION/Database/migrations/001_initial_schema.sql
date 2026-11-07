-- ============================================================
-- SILID Voucher Service — Initial Schema
-- Migration 001: Core tables from the ERD
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---- Enum types ----
CREATE TYPE benefit_type    AS ENUM ('PERCENTAGE', 'LEGACY_UNSUPPORTED');
CREATE TYPE batch_status    AS ENUM ('Draft','Active','Paused','Closed','PartiallyUsed','Exhausted');
CREATE TYPE ticket_status   AS ENUM ('Available','Claimed','Cancelled');
CREATE TYPE registration_status AS ENUM ('Pending','Approved','Rejected');
CREATE TYPE voucher_status  AS ENUM ('Active','Held','Redeemed','Expired','Cancelled');
CREATE TYPE staff_role      AS ENUM ('Founder','Manager','Staff');
CREATE TYPE source_type     AS ENUM ('staff_ui','api_v1','offline_sync');

-- ---- STAFF ----
CREATE TABLE staff (
  staff_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name  TEXT        NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  role        staff_role  NOT NULL DEFAULT 'Staff',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE staff IS 'Staff members who manage vouchers (ERD: STAFF)';

-- ---- VOUCHER_TEMPLATE ----
CREATE TABLE voucher_template (
  template_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_staff_id  UUID        NOT NULL REFERENCES staff(staff_id) ON DELETE RESTRICT,
  template_name        TEXT        NOT NULL,
  benefit_type         benefit_type NOT NULL,
  benefit_value        NUMERIC(5,2) NOT NULL CHECK (benefit_value > 0 AND benefit_value <= 100),
  effective_duration   INT         NOT NULL CHECK (effective_duration > 0),
  restrictions         TEXT,
  excluded_products    JSONB       NOT NULL DEFAULT '["Intensive Pass","Hub Reservations"]',
  description          TEXT,
  status               TEXT        NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE voucher_template IS 'Reusable discount definitions (ERD: VOUCHER_TEMPLATE)';

-- ---- VOUCHER_BATCH ----
CREATE TABLE voucher_batch (
  batch_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id          UUID         NOT NULL REFERENCES voucher_template(template_id) ON DELETE RESTRICT,
  created_by_staff_id  UUID         NOT NULL REFERENCES staff(staff_id) ON DELETE RESTRICT,
  event_name           TEXT         NOT NULL,
  event_date           DATE         NOT NULL,
  claim_deadline       DATE         NOT NULL,
  batch_quantity       INT          NOT NULL CHECK (batch_quantity > 0),
  max_redemptions      INT          NOT NULL CHECK (max_redemptions > 0),
  status               batch_status NOT NULL DEFAULT 'Draft',
  code_prefix          TEXT         DEFAULT 'CT',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_max_leq_qty CHECK (max_redemptions <= batch_quantity)
);
COMMENT ON TABLE voucher_batch IS 'A batch of claim tickets for one event (ERD: VOUCHER_BATCH)';

-- ---- CLAIM_TICKET ----
CREATE TABLE claim_ticket (
  claim_ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID          NOT NULL REFERENCES voucher_batch(batch_id) ON DELETE RESTRICT,
  claim_code      TEXT          UNIQUE NOT NULL,
  qr_code_data    TEXT          NOT NULL,
  status          ticket_status NOT NULL DEFAULT 'Available',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE claim_ticket IS 'Individual claim codes distributed to students (ERD: CLAIM_TICKET)';

-- ---- STUDENT ----
CREATE TABLE student (
  student_id       TEXT PRIMARY KEY,
  student_name     TEXT NOT NULL,
  email            TEXT NOT NULL,
  mobile_number    TEXT,
  silid_member_ref TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE student IS 'Students who register for vouchers (ERD: STUDENT)';

-- ---- REGISTRATION ----
CREATE TABLE registration (
  registration_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           TEXT                NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  batch_id             UUID                NOT NULL REFERENCES voucher_batch(batch_id) ON DELETE RESTRICT,
  claim_ticket_id      UUID                UNIQUE NOT NULL REFERENCES claim_ticket(claim_ticket_id) ON DELETE RESTRICT,
  reviewed_by_staff_id UUID                REFERENCES staff(staff_id) ON DELETE RESTRICT,
  submitted_at         TIMESTAMPTZ         NOT NULL DEFAULT now(),
  reviewed_at          TIMESTAMPTZ,
  status               registration_status NOT NULL DEFAULT 'Pending',
  rejection_reason     TEXT,
  status_token         TEXT                UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  CONSTRAINT uq_student_batch UNIQUE (student_id, batch_id)
);
COMMENT ON TABLE registration IS 'Student claim-ticket registrations (ERD: REGISTRATION)';

-- ---- PERSONAL_VOUCHER ----
CREATE TABLE personal_voucher (
  personal_voucher_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id     UUID           UNIQUE NOT NULL REFERENCES registration(registration_id) ON DELETE RESTRICT,
  issued_by_staff_id  UUID           NOT NULL REFERENCES staff(staff_id) ON DELETE RESTRICT,
  personal_qr_code    TEXT           UNIQUE NOT NULL,
  issued_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  expiry_date         TIMESTAMPTZ    NOT NULL,
  status              voucher_status NOT NULL DEFAULT 'Active'
);
COMMENT ON TABLE personal_voucher IS 'Issued personal discount voucher (ERD: PERSONAL_VOUCHER)';

-- ---- REDEMPTION ----
CREATE TABLE redemption (
  redemption_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_voucher_id    UUID        NOT NULL REFERENCES personal_voucher(personal_voucher_id) ON DELETE RESTRICT,
  processed_by_staff_id  UUID        REFERENCES staff(staff_id) ON DELETE RESTRICT,
  redeemed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_reversed            BOOLEAN     NOT NULL DEFAULT false,
  reversed_at            TIMESTAMPTZ,
  reversed_by_staff_id   UUID        REFERENCES staff(staff_id) ON DELETE RESTRICT,
  reversal_reason        TEXT,
  source                 source_type NOT NULL DEFAULT 'staff_ui',
  session_ref            TEXT,
  idempotency_key        TEXT,
  gross_amount           NUMERIC(12,2),
  discount_amount        NUMERIC(12,2),
  net_amount             NUMERIC(12,2)
);
COMMENT ON TABLE redemption IS 'Successful redemption events (ERD: REDEMPTION)';

-- One active (non-reversed) redemption per voucher — partial unique index
-- This is a documented deviation: reversals return the voucher to Active (§6)
CREATE UNIQUE INDEX idx_redemption_active_per_voucher
  ON redemption (personal_voucher_id) WHERE NOT is_reversed;

CREATE UNIQUE INDEX idx_redemption_idempotency
  ON redemption (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- Triggers
-- ============================================================

-- Ticket-batch consistency (§4 rule)
CREATE OR REPLACE FUNCTION fn_check_ticket_batch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ticket_batch UUID;
BEGIN
  SELECT batch_id INTO v_ticket_batch FROM claim_ticket WHERE claim_ticket_id = NEW.claim_ticket_id;
  IF v_ticket_batch IS DISTINCT FROM NEW.batch_id THEN
    RAISE EXCEPTION 'Claim ticket batch_id (%) does not match registration batch_id (%)', v_ticket_batch, NEW.batch_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_check_ticket_batch BEFORE INSERT OR UPDATE ON registration FOR EACH ROW EXECUTE FUNCTION fn_check_ticket_batch();

-- Auto updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_staff_updated    BEFORE UPDATE ON staff            FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_template_updated BEFORE UPDATE ON voucher_template FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_batch_updated    BEFORE UPDATE ON voucher_batch    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_student_updated  BEFORE UPDATE ON student          FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
