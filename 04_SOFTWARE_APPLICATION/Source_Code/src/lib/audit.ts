import { createAdminClient } from './supabase/admin';
import { isOutsideOperatingHours } from './timezone';

export interface AuditEntry {
  actorStaffId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  anomalyFlags?: string[];
}

/**
 * Write to the tamper-evident audit trail (§7).
 * Audit failures are non-blocking to the primary business transaction.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const anomalyFlags = [...(entry.anomalyFlags || [])];

    // Automatic anomaly detection: redemptions/actions outside business operating hours
    if (isOutsideOperatingHours()) {
      anomalyFlags.push('OUTSIDE_BUSINESS_HOURS');
    }

    await admin.from('audit_log').insert({
      actor_staff_id: entry.actorStaffId ?? null,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      before_value: entry.beforeValue ? JSON.stringify(entry.beforeValue) : null,
      after_value: entry.afterValue ? JSON.stringify(entry.afterValue) : null,
      reason: entry.reason ?? null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      anomaly_flags: anomalyFlags,
    });
  } catch (err) {
    console.error('[Audit] Failed to write audit log entry:', err);
  }
}

/**
 * Detect redemption anomalies for security auditing
 */
export function detectRedemptionAnomalies(opts: {
  redeemedAt: Date;
  staffId: string;
  batchUsedPercent: number;
}): string[] {
  const flags: string[] = [];
  if (opts.batchUsedPercent >= 0.9 && opts.batchUsedPercent < 1.0) {
    flags.push('BATCH_NEAR_CAP_90_PERCENT');
  } else if (opts.batchUsedPercent >= 1.0) {
    flags.push('BATCH_CAP_REACHED');
  }
  return flags;
}

/**
 * Check for redemptions volume anomaly or near cap
 */
export function detectBatchAnomaly(usedPercent: number): string[] {
  const flags: string[] = [];
  if (usedPercent >= 0.9 && usedPercent < 1.0) {
    flags.push('BATCH_NEAR_CAP_90_PERCENT');
  } else if (usedPercent >= 1.0) {
    flags.push('BATCH_CAP_REACHED');
  }
  return flags;
}
