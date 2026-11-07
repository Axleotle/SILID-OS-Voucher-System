import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  claim_code: z.string().min(1),
  student_id: z.string().min(1),
  student_name: z.string().min(1),
  email: z.string().email(),
  mobile_number: z.string().optional(),
  /**
   * Data Privacy Act consent — must be explicitly true.
   * Collecting personal information without consent violates RA 10173.
   */
  dpa_consent: z.literal(true, {
    errorMap: () => ({
      message: 'You must accept the Data Privacy Act consent to register.',
    }),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        },
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { claim_code, student_id, student_name, email, mobile_number } = parsed.data;

  // Look up claim ticket (join batch inline for deadline check)
  const { data: ticket } = await admin
    .from('claim_ticket')
    .select('*, voucher_batch!inner(*)')
    .eq('claim_code', claim_code)
    .single();

  if (!ticket) {
    return Response.json(
      { error: { code: 'TICKET_NOT_FOUND', message: 'Claim code not found. Please check the code and try again.' } },
      { status: 404 },
    );
  }

  if (ticket.status !== 'Available') {
    const message =
      ticket.status === 'Claimed'
        ? 'This claim code has already been used.'
        : 'This claim code is no longer valid.';
    return Response.json(
      { error: { code: 'TICKET_UNAVAILABLE', message } },
      { status: 422 },
    );
  }

  let batch = ticket.voucher_batch as any;
  if (!batch && (ticket as any).batch_id) {
    const { data: b } = await admin
      .from('voucher_batch')
      .select('*')
      .eq('batch_id', (ticket as any).batch_id)
      .maybeSingle();
    batch = b;
  }

  // Check claim deadline (using server time — cannot trust client clock)
  if (batch?.claim_deadline && new Date(batch.claim_deadline) < new Date()) {
    return Response.json(
      { error: { code: 'DEADLINE_PASSED', message: 'The claim deadline for this voucher has passed.' } },
      { status: 422 },
    );
  }

  if (batch?.status && !['Active', 'Draft', 'PartiallyUsed'].includes(batch.status)) {
    return Response.json(
      { error: { code: 'BATCH_CLOSED', message: 'This voucher batch is no longer accepting registrations.' } },
      { status: 422 },
    );
  }

  // Duplicate registration guard (before insert to give a friendly message)
  const { data: existing } = await admin
    .from('registration')
    .select('registration_id')
    .eq('student_id', student_id)
    .eq('batch_id', batch.batch_id)
    .single();

  if (existing) {
    return Response.json(
      { error: { code: 'ALREADY_REGISTERED', message: 'You have already registered for this voucher batch.' } },
      { status: 422 },
    );
  }

  // Upsert student record (minimal PII, as required by RA 10173 data minimisation)
  await admin
    .from('student')
    .upsert({ student_id, student_name, email, mobile_number }, { onConflict: 'student_id' });

  const generatedToken = crypto.randomBytes(24).toString('hex');

  // Create registration
  const { data: registration, error: regError } = await admin
    .from('registration')
    .insert({
      student_id,
      batch_id: batch.batch_id,
      claim_ticket_id: ticket.claim_ticket_id,
      status: 'Pending',
      status_token: generatedToken,
    })
    .select()
    .single();

  if (regError) {
    // Unique constraint violation — concurrent duplicate request
    if (regError.code === '23505') {
      return Response.json(
        { error: { code: 'ALREADY_REGISTERED', message: 'You have already registered for this voucher batch.' } },
        { status: 422 },
      );
    }
    return Response.json(
      { error: { code: 'DB_ERROR', message: 'Registration failed. Please try again.' } },
      { status: 500 },
    );
  }

  // Mark claim ticket as Claimed (best-effort — registration already committed above)
  await admin
    .from('claim_ticket')
    .update({ status: 'Claimed' })
    .eq('claim_ticket_id', ticket.claim_ticket_id);

  writeAuditLog({
    action: 'STUDENT_REGISTERED',
    entityType: 'registration',
    entityId: registration.registration_id,
    afterValue: { student_id, batch_id: batch.batch_id, claim_code },
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  }).catch(() => {});

  const token = registration?.status_token || generatedToken;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return Response.json(
    {
      success: true,
      registration_id: registration.registration_id,
      status_token: token,
      status_url: `${baseUrl}/status/${token}`,
      message:
        'Registration submitted successfully. You will receive an email when your voucher is ready.',
    },
    { status: 201 },
  );
}
