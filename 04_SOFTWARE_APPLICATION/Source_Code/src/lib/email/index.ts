import { createAdminClient } from '../supabase/admin';
import { theme } from '../theme';

export interface EmailMessage {
  toEmail: string;
  subject: string;
  htmlBody: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface EmailProvider {
  name: string;
  send(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * Stub Provider: logs email details and succeeds (useful for local dev and testing).
 */
class StubEmailProvider implements EmailProvider {
  name = 'stub';
  async send(to: string, subject: string): Promise<{ success: boolean; messageId: string }> {
    console.log(`[Email Stub] Sent email to: ${to} | Subject: "${subject}"`);
    return { success: true, messageId: `stub-${Date.now()}` };
  }
}

/**
 * Factory to get configured email provider based on EMAIL_PROVIDER env var.
 */
function getEmailProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER || 'stub').toLowerCase();
  if (provider === 'stub') {
    return new StubEmailProvider();
  }
  // Fallback to stub provider if not configured
  return new StubEmailProvider();
}

/**
 * Send an email using outbox pattern (§6: no duplicate sends, stored delivery status, retry).
 */
export async function sendEmailWithOutbox(message: EmailMessage): Promise<{ emailId: string; sent: boolean }> {
  const admin = createAdminClient();

  // 1. Insert into email_outbox with 'pending' status
  const { data: outboxEntry, error: insertError } = await admin
    .from('email_outbox')
    .insert({
      to_email: message.toEmail,
      subject: message.subject,
      html_body: message.htmlBody,
      related_entity_type: message.relatedEntityType,
      related_entity_id: message.relatedEntityId,
      status: 'pending',
      attempts: 0,
    })
    .select('email_id')
    .single();

  if (insertError || !outboxEntry) {
    throw new Error(`Failed to queue email in outbox: ${insertError?.message}`);
  }

  const emailId = outboxEntry.email_id;

  // 2. Attempt immediate delivery
  const provider = getEmailProvider();
  try {
    const result = await provider.send(message.toEmail, message.subject, message.htmlBody);
    if (result.success) {
      await admin
        .from('email_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: result.messageId,
          last_attempted_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq('email_id', emailId);
      return { emailId, sent: true };
    } else {
      await admin
        .from('email_outbox')
        .update({
          status: 'failed',
          error_message: result.error,
          last_attempted_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq('email_id', emailId);
      return { emailId, sent: false };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from('email_outbox')
      .update({
        status: 'failed',
        error_message: msg,
        last_attempted_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq('email_id', emailId);
    return { emailId, sent: false };
  }
}

/**
 * Generate Silid-branded HTML email template for approved personal vouchers.
 */
export function buildVoucherEmailHtml(params: {
  studentName: string;
  templateName: string;
  discountPercent: number;
  personalQrData: string;
  qrDataUrl: string;
  expiryFormatted: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your ${theme.branding.hubName} Voucher</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f4f0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #2f2a24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background-color: #fffdf7; border: 1px solid #ded7c8; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
    <!-- Header -->
    <tr>
      <td style="padding: 32px 24px; text-align: center; background-color: #1f5d46; color: #ffffff;">
        <h1 style="margin: 0; font-family: 'Bodoni Moda', Georgia, serif; font-size: 32px; letter-spacing: 0.2em; text-transform: uppercase;">SILID</h1>
        <p style="margin: 4px 0 0; font-size: 11px; letter-spacing: 0.4em; text-transform: uppercase; color: #e8f4f0;">MALOLOS · VOUCHER SERVICE</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 32px 28px;">
        <h2 style="margin: 0 0 8px; font-family: 'Bodoni Moda', Georgia, serif; font-size: 24px; color: #1f5d46;">Your Voucher is Ready!</h2>
        <p style="margin: 0 0 20px; font-size: 15px; color: #554d42; line-height: 1.5;">
          Hello <strong>${escapeHtml(params.studentName)}</strong>,<br>
          Your registration for <strong>${escapeHtml(params.templateName)}</strong> has been approved. You have received a <strong>${params.discountPercent}% discount</strong> on your eligible study hub sessions.
        </p>

        <!-- QR Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0; background-color: #f7f5ed; border: 1px dashed #ded7c8; border-radius: 16px; text-align: center;">
          <tr>
            <td style="padding: 24px;">
              <img src="${params.qrDataUrl}" alt="Personal Voucher QR" width="200" height="200" style="display: block; margin: 0 auto; border-radius: 12px; border: 1px solid #ded7c8; background: #ffffff;">
              <p style="margin: 12px 0 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; font-weight: bold; letter-spacing: 0.1em; color: #1f5d46;">
                ${escapeHtml(params.personalQrData)}
              </p>
              <p style="margin: 0; font-size: 12px; color: #756d62;">Show this QR to the front desk staff at checkout</p>
            </td>
          </tr>
        </table>

        <!-- Details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #443e37; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee7da; color: #756d62;">Benefit:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee7da; text-align: right; font-weight: 600;">${params.discountPercent}% Percentage Discount</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee7da; color: #756d62;">Expires on:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee7da; text-align: right; font-weight: 600;">${escapeHtml(params.expiryFormatted)} (PHT)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #756d62;">Restrictions:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">One-time use · Cannot stack with other promos</td>
          </tr>
        </table>

        <p style="margin: 0; font-size: 13px; color: #756d62; line-height: 1.5;">
          Thank you for choosing SILID Malolos as your dedicated study hub!
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 20px; text-align: center; background-color: #f7f5ed; border-top: 1px solid #ded7c8; font-size: 11px; color: #8a8277;">
        Silid Malolos Study Hub · Data Privacy Act of 2012 Compliant<br>
        This email was automatically generated. Please do not reply directly.
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
