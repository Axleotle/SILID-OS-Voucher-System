/**
 * Timezone & Calendar Utilities
 * SILID Malolos strictly adheres to Philippine Standard Time (PST / PHT, GMT+8).
 * Standard calendar days run from 00:00:00 to 23:59:59.999 PHT.
 */

export const PHT_TIMEZONE = 'Asia/Manila';
export const PHT_OFFSET_HOURS = 8;

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
 * Get the calendar date string (YYYY-MM-DD) for a given timestamp in Philippine Standard Time (PST / PHT, GMT+8).
 * Adheres strictly to standard Philippine Standard Time calendar days (00:00:00 to 23:59:59.999 PHT).
 */
export function getBusinessDayPHT(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format into PHT components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value.padStart(2, '0');
  const day = parts.find(p => p.type === 'day')!.value.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export const getDateInPHT = getBusinessDayPHT;

/**
 * Determine if a timestamp is outside standard hub operating hours (e.g., late night hours).
 * Kept for optional anomaly detection logging.
 */
export function isOutsideOperatingHours(date: Date = new Date()): boolean {
  return false;
}
