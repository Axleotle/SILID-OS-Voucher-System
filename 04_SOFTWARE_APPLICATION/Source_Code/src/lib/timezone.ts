/**
 * Timezone & Business Day Utilities
 * SILID Malolos operates on Asia/Manila (GMT+8).
 * Business Day runs from 6:00 AM PHT to the following 6:00 AM PHT (§7).
 */

export const PHT_TIMEZONE = 'Asia/Manila';
export const PHT_OFFSET_HOURS = 8;
export const BUSINESS_DAY_CUTOFF_HOUR = 6; // 6:00 AM

/**
 * Format a Date object into Manila time ISO-like string: YYYY-MM-DD HH:mm:ss
 */
export function formatInPHT(date?: Date | string | null): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: PHT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Format a Date object for display in PHT: e.g. "Nov 6, 2026, 11:30 PM"
 */
export function formatDisplayPHT(date?: Date | string | null): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: PHT_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Calculate expiry date from issuedAt and effectiveDuration days.
 * Appendix rule: Calculate expiryDate from effectiveDuration. Use end of day in PHT (23:59:59.999).
 */
export function calculateExpiryDate(issuedAt: Date, effectiveDurationDays: number): Date {
  // Convert issuedAt to PHT calendar components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHT_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(issuedAt);
  const phtYear = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const phtMonth = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1; // 0-indexed
  const phtDay = parseInt(parts.find(p => p.type === 'day')!.value, 10);

  // Add effectiveDurationDays to the PHT calendar date
  // End of day in PHT is 23:59:59.999 PHT (which is 15:59:59.999 UTC)
  const targetDatePHT = new Date(Date.UTC(phtYear, phtMonth, phtDay + effectiveDurationDays, 23 - PHT_OFFSET_HOURS, 59, 59, 999));
  return targetDatePHT;
}

/**
 * Check if a voucher's expiryDate has passed
 */
export function isExpired(expiryDate: Date | string, now: Date = new Date()): boolean {
  const exp = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  return now.getTime() > exp.getTime();
}

/**
 * Get the Business Day date string (YYYY-MM-DD) for a given timestamp in PHT.
 * The Business Day runs from 6:00 AM PHT to the following 6:00 AM PHT.
 * E.g., Nov 6 at 05:00 AM PHT belongs to Business Day Nov 5.
 * Nov 6 at 06:01 AM PHT belongs to Business Day Nov 6.
 */
export function getBusinessDayPHT(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format into PHT components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  let year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  let month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
  let day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);

  // If before 6 AM PHT, roll back one day
  if (hour < BUSINESS_DAY_CUTOFF_HOUR) {
    const prevDay = new Date(Date.UTC(year, month - 1, day - 1));
    year = prevDay.getUTCFullYear();
    month = prevDay.getUTCMonth() + 1;
    day = prevDay.getUTCDate();
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Determine if a timestamp is outside standard hub operating hours (e.g., between midnight and 6 AM PHT).
 * Used for anomaly detection flags (§7).
 */
export function isOutsideOperatingHours(date: Date = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHT_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  });
  const hour = parseInt(formatter.format(date), 10);
  // Anomaly: redemption between 00:00 and 06:00 PHT
  return hour >= 0 && hour < BUSINESS_DAY_CUTOFF_HOUR;
}
