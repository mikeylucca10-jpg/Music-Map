import {
  dateKeyFor,
  formatConcertDateTime,
  formatDateKeyLabel,
  formatWeekRangeLabel,
  getNycDateKey,
} from '@/lib/format-date';

describe('getNycDateKey', () => {
  it('uses the NYC calendar day, not the UTC one', () => {
    // 02:00 UTC on Aug 14 is still 22:00 on Aug 13 in New York (EDT, UTC-4).
    // A naive UTC-based key would wrongly say 2026-08-14 and file a late-night
    // show under the following day.
    expect(getNycDateKey(new Date('2026-08-14T02:00:00Z'))).toBe('2026-08-13');
  });

  it('handles standard time as well as daylight time', () => {
    // January is EST (UTC-5), so 04:00 UTC is still 23:00 the previous day.
    expect(getNycDateKey(new Date('2026-01-15T04:00:00Z'))).toBe('2026-01-14');
  });

  it('formats as zero-padded YYYY-MM-DD', () => {
    expect(getNycDateKey(new Date('2026-01-05T17:00:00Z'))).toBe('2026-01-05');
  });
});

describe('dateKeyFor', () => {
  it('treats month as zero-indexed to match Date', () => {
    expect(dateKeyFor(2026, 7, 5)).toBe('2026-08-05');
  });

  it('zero-pads single-digit months and days', () => {
    expect(dateKeyFor(2026, 0, 1)).toBe('2026-01-01');
  });

  it('round-trips through formatDateKeyLabel without an off-by-one', () => {
    // Building the key from integers and formatting it back must land on the
    // same calendar day — the classic failure is parsing 'YYYY-MM-DD' as UTC
    // midnight and rendering the previous day in a negative-offset timezone.
    expect(formatDateKeyLabel(dateKeyFor(2026, 7, 13))).toBe('Thu, Aug 13');
  });
});

describe('formatWeekRangeLabel', () => {
  it('renders a compact month/day range', () => {
    expect(formatWeekRangeLabel(new Date(2026, 7, 24), new Date(2026, 7, 30))).toBe(
      'Aug 24 – Aug 30',
    );
  });
});

describe('formatConcertDateTime', () => {
  it('renders the instant in NYC time', () => {
    const label = formatConcertDateTime('2026-08-14T02:00:00Z');
    // 22:00 EDT on the 13th, not 02:00 UTC on the 14th.
    expect(label).toContain('Aug 13');
    expect(label).toContain('10:00');
  });
});
