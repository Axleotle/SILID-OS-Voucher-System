-- ============================================================
-- Migration 002: Support tables (feature flags, API keys, audit, outbox, legacy)
-- ============================================================

CREATE TABLE feature_flag (
  flag_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key          TEXT UNIQUE NOT NULL,
  is_enabled        BOOLEAN NOT NULL DEFAULT false,
  description       TEXT,
  updated_by_staff_id UUID REFERENCES staff(staff_id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO feature_flag (flag_key, description) VALUES
  ('api_v1_validate','Enable /api/v1/vouchers/validate'),
  ('api_v1_hold','Enable hold/release endpoints'),
  ('api_v1_redeem','Enable /api/v1/vouchers/redeem'),
  ('api_v1_reverse','Enable /api/v1/vouchers/reverse'),
  ('api_v1_ledger_events','Enable ledger event pull'),
  ('email_delivery','Enable sending emails'),
  ('api_v1_start_session','Silid OS Start Session integration'),
  ('api_v1_active_sessions','Silid OS Active Sessions integration'),
  ('api_v1_checkout','Silid OS Checkout integration');

CREATE TABLE api_key (
  api_key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL,
  created_by_staff_id UUID REFERENCES staff(staff_id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_minute INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_used_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_staff_id UUID, actor_role TEXT, action TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  before_value JSONB, after_value JSONB, reason TEXT,
  ip_address TEXT, user_agent TEXT, anomaly_flags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_entity  ON audit_log(entity_type, entity_id);

CREATE TABLE ledger_outbox (
  outbox_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sent','failed')),
  attempts INT NOT NULL DEFAULT 0, last_attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), error_message TEXT
);

CREATE TABLE email_outbox (
  email_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL, subject TEXT NOT NULL, html_body TEXT NOT NULL,
  related_entity_type TEXT, related_entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sent','failed')),
  attempts INT NOT NULL DEFAULT 0, last_attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message TEXT, provider_message_id TEXT
);

CREATE TABLE legacy_voucher (
  legacy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_code TEXT NOT NULL, original_type TEXT NOT NULL,
  original_data JSONB NOT NULL, import_batch TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by_staff_id UUID REFERENCES staff(staff_id), notes TEXT
);

-- Atomic redemption function (§4: lock batch → lock voucher → validate → insert)
CREATE OR REPLACE FUNCTION atomic_redeem_voucher(
  p_personal_qr_code TEXT, p_processed_by_staff_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'staff_ui', p_session_ref TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL, p_line_items JSONB DEFAULT NULL,
  p_has_other_promotions BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_voucher personal_voucher%ROWTYPE; v_reg registration%ROWTYPE;
  v_batch voucher_batch%ROWTYPE; v_tmpl voucher_template%ROWTYPE;
  v_redeemed INT; v_rid UUID; v_pct NUMERIC(5,2);
BEGIN
  IF p_has_other_promotions THEN
    RAISE EXCEPTION '[NO_STACKING] Vouchers cannot be combined with other promotions.';
  END IF;
  SELECT * INTO v_voucher FROM personal_voucher WHERE personal_qr_code = p_personal_qr_code;
  IF NOT FOUND THEN RAISE EXCEPTION '[VOUCHER_NOT_FOUND] Voucher not found.'; END IF;
  SELECT * INTO v_reg FROM registration WHERE registration_id = v_voucher.registration_id;
  SELECT * INTO v_batch FROM voucher_batch WHERE batch_id = v_reg.batch_id FOR UPDATE;
  SELECT * INTO v_voucher FROM personal_voucher WHERE personal_voucher_id = v_voucher.personal_voucher_id FOR UPDATE;
  SELECT * INTO v_tmpl FROM voucher_template WHERE template_id = v_batch.template_id;
  IF v_voucher.status <> 'Active' THEN
    RAISE EXCEPTION '[VOUCHER_%] Status is %. Must be Active.', UPPER(v_voucher.status::text), v_voucher.status;
  END IF;
  IF v_voucher.expiry_date < now() THEN
    UPDATE personal_voucher SET status='Expired' WHERE personal_voucher_id=v_voucher.personal_voucher_id;
    RAISE EXCEPTION '[VOUCHER_EXPIRED] Expired on %.', to_char(v_voucher.expiry_date AT TIME ZONE 'Asia/Manila','YYYY-MM-DD');
  END IF;
  IF v_batch.status NOT IN ('Active','PartiallyUsed') THEN
    RAISE EXCEPTION '[BATCH_CLOSED] Batch status is %.', v_batch.status;
  END IF;
  IF v_tmpl.status <> 'Active' THEN RAISE EXCEPTION '[TEMPLATE_INACTIVE] Template inactive.'; END IF;
  SELECT count(*) INTO v_redeemed FROM redemption r
    JOIN personal_voucher pv ON pv.personal_voucher_id=r.personal_voucher_id
    JOIN registration rg ON rg.registration_id=pv.registration_id
   WHERE rg.batch_id=v_batch.batch_id AND r.is_reversed=false;
  IF v_redeemed >= v_batch.max_redemptions THEN
    RAISE EXCEPTION '[BATCH_CAP_REACHED] Cap reached (% of %).', v_redeemed, v_batch.max_redemptions;
  END IF;
  v_rid := gen_random_uuid(); v_pct := v_tmpl.benefit_value;
  INSERT INTO redemption(redemption_id,personal_voucher_id,processed_by_staff_id,source,session_ref,idempotency_key,gross_amount,discount_amount,net_amount)
  VALUES(v_rid,v_voucher.personal_voucher_id,p_processed_by_staff_id,p_source::source_type,p_session_ref,p_idempotency_key,0,0,0);
  UPDATE personal_voucher SET status='Redeemed' WHERE personal_voucher_id=v_voucher.personal_voucher_id;
  v_redeemed := v_redeemed+1;
  IF v_redeemed >= v_batch.max_redemptions THEN
    UPDATE voucher_batch SET status='Exhausted',updated_at=now() WHERE batch_id=v_batch.batch_id;
  ELSIF v_redeemed > 0 THEN
    UPDATE voucher_batch SET status='PartiallyUsed',updated_at=now() WHERE batch_id=v_batch.batch_id;
  END IF;
  RETURN jsonb_build_object('redemption_id',v_rid,'discount_percent',v_pct,'gross_amount',0,'discount_amount',0,'net_amount',0,'batch_used_percent',round(v_redeemed::numeric/v_batch.max_redemptions,4));
END; $$;

-- Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE student ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_voucher ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_read  ON staff FOR SELECT TO authenticated USING(true);
CREATE POLICY tmpl_read   ON voucher_template FOR SELECT TO authenticated USING(true);
CREATE POLICY batch_read  ON voucher_batch FOR SELECT TO authenticated USING(true);
CREATE POLICY ticket_read ON claim_ticket FOR SELECT TO authenticated USING(true);
CREATE POLICY student_read ON student FOR SELECT TO authenticated USING(true);
CREATE POLICY reg_read    ON registration FOR SELECT TO authenticated USING(true);
CREATE POLICY pv_read     ON personal_voucher FOR SELECT TO authenticated USING(true);
CREATE POLICY red_read    ON redemption FOR SELECT TO authenticated USING(true);
CREATE POLICY ff_read     ON feature_flag FOR SELECT TO authenticated USING(true);
CREATE POLICY audit_read  ON audit_log FOR SELECT TO authenticated USING(true);

CREATE POLICY tmpl_write  ON voucher_template FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY batch_write ON voucher_batch FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY ticket_write ON claim_ticket FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY student_write ON student FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY reg_write   ON registration FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY pv_write    ON personal_voucher FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY red_write   ON redemption FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY audit_ins   ON audit_log FOR INSERT TO authenticated WITH CHECK(true);
CREATE POLICY ff_write    ON feature_flag FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY ak_service  ON api_key FOR ALL TO service_role USING(true) WITH CHECK(true);
