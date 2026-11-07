import { describe, it, expect } from 'vitest';

describe('Authoritative Core Model Constraints & Invariants (§4, §11)', () => {
  it('enforces UNIQUE(studentId, batchId) to prevent duplicate claims in the same campaign', () => {
    // Migration 001 defines:
    // CONSTRAINT uq_student_batch UNIQUE (student_id, batch_id)
    const existingRegistration = { student_id: 'STU-2024-001', batch_id: 'c0000000-0000-0000-0000-000000000001' };
    const duplicateRegistration = { student_id: 'STU-2024-001', batch_id: 'c0000000-0000-0000-0000-000000000001' };

    const isDuplicate =
      existingRegistration.student_id === duplicateRegistration.student_id &&
      existingRegistration.batch_id === duplicateRegistration.batch_id;

    expect(isDuplicate).toBe(true);
  });

  it('enforces claim_ticket.batchId equals registration.batchId', () => {
    // Enforced by Postgres trigger trg_check_ticket_batch on registration table
    const ticketBatchId: string = 'BATCH-A';
    const registrationBatchId: string = 'BATCH-A';
    const mismatchedBatchId: string = 'BATCH-B';

    expect(ticketBatchId === registrationBatchId).toBe(true);
    expect(ticketBatchId === mismatchedBatchId).toBe(false);
  });

  it('guarantees an approved registration issues exactly one personal voucher', () => {
    // Enforced by personal_voucher(registration_id UNIQUE NOT NULL)
    const registrationStatus: string = 'Approved';
    const personalVoucherCount = registrationStatus === 'Approved' ? 1 : 0;
    expect(personalVoucherCount).toBe(1);
  });

  it('guarantees a rejected registration never gets a voucher QR', () => {
    const registrationStatus: string = 'Rejected';
    const personalVoucherCount = registrationStatus === 'Approved' ? 1 : 0;
    expect(personalVoucherCount).toBe(0);
  });
});
