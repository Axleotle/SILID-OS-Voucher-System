-- =============================================================================
-- Migration 004: atomic_redeem_voucher Postgres function
-- Purpose : Atomically validate, lock, and redeem a personal voucher.
--           Called by the application layer via Supabase RPC.
-- Locking : Locks voucher_batch first (prevents batch-cap race across
--           concurrent requests), then personal_voucher, to enforce a
--           consistent lock order and avoid deadlocks.
-- =============================================================================

CREATE OR REPLACE FUNCTION atomic_redeem_voucher(
  p_personal_qr_code      TEXT,
  p_processed_by_staff_id UUID,
  p_source                TEXT,
  p_session_ref           TEXT,
  p_idempotency_key       TEXT,
  p_line_items            JSONB,
  p_has_other_promotions  BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher              personal_voucher%ROWTYPE;
  v_registration         registration%ROWTYPE;
  v_batch                voucher_batch%ROWTYPE;
  v_template             voucher_template%ROWTYPE;
  v_redeemed_count       INT;
  v_redemption_id        UUID;
  v_gross                NUMERIC(12,2) := 0;
  v_discount             NUMERIC(12,2) := 0;
  v_net                  NUMERIC(12,2) := 0;
  v_batch_used_percent   NUMERIC(5,4)  := 0;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. Stacking guard (fast path before any I/O)
  -- -------------------------------------------------------------------------
  IF p_has_other_promotions THEN
    RAISE EXCEPTION '[NO_STACKING] Vouchers cannot be combined with other promotions.';
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. Look up voucher (no lock yet — just to discover IDs)
  -- -------------------------------------------------------------------------
  SELECT * INTO v_voucher
  FROM personal_voucher
  WHERE personal_qr_code = p_personal_qr_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[VOUCHER_NOT_FOUND] Voucher not found.';
  END IF;

  -- Look up registration to get batch_id
  SELECT * INTO v_registration
  FROM registration
  WHERE registration_id = v_voucher.registration_id;

  -- -------------------------------------------------------------------------
  -- 3. Lock the BATCH row first (prevents batch-cap overflow across
  --    concurrent vouchers in the same batch — the outer lock boundary)
  --    NOWAIT: fail fast rather than queuing to surface contention quickly.
  -- -------------------------------------------------------------------------
  BEGIN
    SELECT * INTO v_batch
    FROM voucher_batch
    WHERE batch_id = v_registration.batch_id
    FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION '[BATCH_LOCKED] Batch is being updated by another request. Please retry.';
  END;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[BATCH_NOT_FOUND] Voucher batch not found.';
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. Lock the VOUCHER row (prevents double-redemption of the same voucher)
  -- -------------------------------------------------------------------------
  BEGIN
    SELECT * INTO v_voucher
    FROM personal_voucher
    WHERE personal_voucher_id = v_voucher.personal_voucher_id
    FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION '[VOUCHER_LOCKED] Voucher is being processed by another request. Please retry.';
  END;

  -- -------------------------------------------------------------------------
  -- 5. Look up template (read-only, templates rarely change)
  -- -------------------------------------------------------------------------
  SELECT * INTO v_template
  FROM voucher_template
  WHERE template_id = v_batch.template_id;

  -- -------------------------------------------------------------------------
  -- 6. Post-lock validations (TOCTOU-safe — state may have changed since the
  --    application layer last checked)
  -- -------------------------------------------------------------------------

  -- Voucher status
  IF v_voucher.status <> 'Active' THEN
    RAISE EXCEPTION '[VOUCHER_%] Voucher is not active (status: %).',
      UPPER(v_voucher.status), v_voucher.status;
  END IF;

  -- Expiry (using server timezone-aware comparison)
  IF v_voucher.expiry_date < NOW() THEN
    -- Mark as expired so the UI reflects current state
    UPDATE personal_voucher
    SET status = 'Expired'
    WHERE personal_voucher_id = v_voucher.personal_voucher_id;

    RAISE EXCEPTION '[VOUCHER_EXPIRED] This voucher expired on %.',
      TO_CHAR(v_voucher.expiry_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD');
  END IF;

  -- Batch status
  IF v_batch.status NOT IN ('Active', 'PartiallyUsed') THEN
    RAISE EXCEPTION '[BATCH_CLOSED] The voucher batch is no longer accepting redemptions.';
  END IF;

  -- Template status
  IF v_template.status <> 'Active' THEN
    RAISE EXCEPTION '[TEMPLATE_INACTIVE] The voucher template is no longer active.';
  END IF;

  -- -------------------------------------------------------------------------
  -- 7. Count active (non-reversed) redemptions for this batch (cap check)
  --    Runs AFTER the batch lock so the count is authoritative.
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_redeemed_count
  FROM redemption r
  JOIN personal_voucher pv ON pv.personal_voucher_id = r.personal_voucher_id
  JOIN registration     rg ON rg.registration_id     = pv.registration_id
  WHERE rg.batch_id    = v_batch.batch_id
    AND r.is_reversed  = FALSE;

  IF v_redeemed_count >= v_batch.max_redemptions THEN
    RAISE EXCEPTION '[BATCH_CAP_REACHED] This voucher campaign has reached its maximum redemption limit (% of %).',
      v_redeemed_count, v_batch.max_redemptions;
  END IF;

  -- -------------------------------------------------------------------------
  -- 8. Insert the redemption record
  -- -------------------------------------------------------------------------
  v_redemption_id := gen_random_uuid();

  INSERT INTO redemption (
    redemption_id,
    personal_voucher_id,
    processed_by_staff_id,
    source,
    session_ref,
    idempotency_key,
    gross_amount,
    discount_amount,
    net_amount
  ) VALUES (
    v_redemption_id,
    v_voucher.personal_voucher_id,
    p_processed_by_staff_id,
    p_source::source_type,
    p_session_ref,
    p_idempotency_key,
    v_gross,
    v_discount,
    v_net
  );

  -- -------------------------------------------------------------------------
  -- 9. Mark voucher as Redeemed
  -- -------------------------------------------------------------------------
  UPDATE personal_voucher
  SET status = 'Redeemed'
  WHERE personal_voucher_id = v_voucher.personal_voucher_id;

  -- -------------------------------------------------------------------------
  -- 10. Update batch status based on new redemption count
  -- -------------------------------------------------------------------------
  v_redeemed_count     := v_redeemed_count + 1;
  v_batch_used_percent := v_redeemed_count::NUMERIC / v_batch.max_redemptions;

  IF v_redeemed_count >= v_batch.max_redemptions THEN
    UPDATE voucher_batch
    SET status     = 'Exhausted',
        updated_at = NOW()
    WHERE batch_id = v_batch.batch_id;
  ELSE
    UPDATE voucher_batch
    SET status     = 'PartiallyUsed',
        updated_at = NOW()
    WHERE batch_id = v_batch.batch_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 11. Return result payload to the application layer
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'redemption_id',       v_redemption_id,
    'discount_percent',    v_template.benefit_value,
    'gross_amount',        v_gross,
    'discount_amount',     v_discount,
    'net_amount',          v_net,
    'batch_used_percent',  v_batch_used_percent
  );
END;
$$;
