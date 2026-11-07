import { describe, it, expect } from 'vitest';
import {
  calculateExpiryDate,
  getBusinessDayPHT,
  isExpired,
  formatInPHT,
} from '../lib/timezone';

describe('Timezone & Business Day Cutoff (§4, §7)', () => {
  it('calculates expiry date at end of day in PHT (23:59:59.999 PHT)', () => {
    // Issued at 2026-11-06 10:00:00 UTC (18:00 PHT) with 30 days duration
    const issuedAt = new Date('2026-11-06T10:00:00Z');
    const expiryDate = calculateExpiryDate(issuedAt, 30);

    // Format in PHT should be 2026-12-06 at 23:59:59
    const phtStr = formatInPHT(expiryDate);
    expect(phtStr).toContain('23:59:59');

    // 1 second prior should NOT be expired
    const justBefore = new Date(expiryDate.getTime() - 1000);
    expect(isExpired(expiryDate, justBefore)).toBe(false);

    // 1 millisecond after SHOULD be expired
    const justAfter = new Date(expiryDate.getTime() + 1);
    expect(isExpired(expiryDate, justAfter)).toBe(true);
  });

  it('determines Business Day based on 6:00 AM PHT cutoff (§7)', () => {
    // 2026-11-06 05:30:00 AM PHT (which is 2026-11-05 21:30:00 UTC)
    // Since before 6:00 AM PHT, belongs to Business Day 2026-11-05
    const beforeCutoff = new Date('2026-11-05T21:30:00Z');
    expect(getBusinessDayPHT(beforeCutoff)).toBe('2026-11-05');

    // 2026-11-06 06:01:00 AM PHT (which is 2026-11-05 22:01:00 UTC)
    // Since at/after 6:00 AM PHT, belongs to Business Day 2026-11-06
    const afterCutoff = new Date('2026-11-05T22:01:00Z');
    expect(getBusinessDayPHT(afterCutoff)).toBe('2026-11-06');

    // 2026-11-06 23:30:00 PM PHT (which is 2026-11-06 15:30:00 UTC)
    // Belongs to Business Day 2026-11-06
    const evening = new Date('2026-11-06T15:30:00Z');
    expect(getBusinessDayPHT(evening)).toBe('2026-11-06');
  });
});
