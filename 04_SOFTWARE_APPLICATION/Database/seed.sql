-- Seed data for development. Demo logins: founder@silid.ph / password123, staff@silid.ph / password123
INSERT INTO staff (staff_id, staff_name, email, role) VALUES
  ('a0000000-0000-0000-0000-000000000001','Admin Founder','founder@silid.ph','Founder'),
  ('a0000000-0000-0000-0000-000000000002','Sample Staff','staff@silid.ph','Staff');

INSERT INTO voucher_template (template_id, created_by_staff_id, template_name, benefit_type, benefit_value, effective_duration, restrictions, description) VALUES
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','30-Day Focus Access Privilege','PERCENTAGE',20,30,'Not valid for Intensive Pass or Hub Reservations','Partner event promotional voucher – 20% discount for 30 days.'),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Sample Loyalty Discount','PERCENTAGE',10,14,'Returning members only','Loyalty – 10% discount for 14 days.');

INSERT INTO voucher_batch (batch_id, template_id, created_by_staff_id, event_name, event_date, claim_deadline, batch_quantity, max_redemptions, status, code_prefix) VALUES
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Youth on the Rock Campus Gathering 2026','2026-12-01','2026-12-15',10,10,'Active','CT-YTR');

INSERT INTO claim_ticket (claim_ticket_id, batch_id, claim_code, qr_code_data, status) VALUES
  ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','CT-YTR-001',encode(gen_random_bytes(16),'hex'),'Claimed'),
  ('d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','CT-YTR-002',encode(gen_random_bytes(16),'hex'),'Claimed'),
  ('d0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','CT-YTR-003',encode(gen_random_bytes(16),'hex'),'Available'),
  ('d0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001','CT-YTR-004',encode(gen_random_bytes(16),'hex'),'Available'),
  ('d0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001','CT-YTR-005',encode(gen_random_bytes(16),'hex'),'Available'),
  ('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001','CT-YTR-006',encode(gen_random_bytes(16),'hex'),'Available'),
  ('d0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001','CT-YTR-007',encode(gen_random_bytes(16),'hex'),'Available'),
  ('d0000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000001','CT-YTR-008',encode(gen_random_bytes(16),'hex'),'Available'),
  ('d0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000001','CT-YTR-009',encode(gen_random_bytes(16),'hex'),'Available'),
  ('d0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000001','CT-YTR-010',encode(gen_random_bytes(16),'hex'),'Available');

INSERT INTO student (student_id, student_name, email, mobile_number) VALUES
  ('STU-2024-001','Jamie Dela Cruz','jamie@example.invalid','09171234567'),
  ('STU-2024-002','Casey Reyes','casey@example.invalid','09181234567');

INSERT INTO registration (registration_id, student_id, batch_id, claim_ticket_id, reviewed_by_staff_id, status, reviewed_at) VALUES
  ('e0000000-0000-0000-0000-000000000001','STU-2024-001','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Approved',now()),
  ('e0000000-0000-0000-0000-000000000002','STU-2024-002','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',NULL,'Pending',NULL);

INSERT INTO personal_voucher (personal_voucher_id, registration_id, issued_by_staff_id, personal_qr_code, expiry_date, status) VALUES
  ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','PV-DEMO-SEED-001',now()+interval '30 days','Active');
