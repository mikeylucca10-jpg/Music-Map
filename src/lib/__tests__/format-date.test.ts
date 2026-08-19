import {
  dateKeyFor,
  formatConcertDateTime,
  formatDateKeyLabel,
  formatTimeZoneAbbreviation,
  formatWeekRangeLabel,
  getConcertDateKey,
} from '@/lib/format-date';

// The real Ticketmaster payload for a Los Angeles show, kept verbatim because
// it is the exact shape that motivated all of this:
//
//   localTime "21:00:00"  dateTime "2026-08-20T04:00:00Z"  venue America/Los_Angeles
//
// Formatted in New York — which the app did for every city — it renders as
// 12:00 AM on Aug 20: wrong hour, wrong day, wrong night of the week.
const LA_SHOW = '2026-08-20T04:00:00Z';
const LA = 'America/Los_Angeles';
const NYC = 'America/New_York';

describe('getConcertDateKey', () => {
  it('uses the venue calendar day, not the UTC one', () => {
    // 02:00 UTC on Aug 14 is still 22:00 on Aug 13 in New York (EDT, UTC-4).
    // A naive UTC-based key would wrongly say 2026-08-14 and file a late-night
    // show under the following day.
    expect(getConcertDateKey(new Date('2026-08-14T02:00:00Z'), NYC)).toBe('2026-08-13');
  });

  it('handles standard time as well as daylight time', () => {
    // January is EST (UTC-5), so 04:00 UTC is still 23:00 the previous day.
    expect(getConcertDateKey(new Date('2026-01-15T04:00:00Z'), NYC)).toBe('2026-01-14');
  });

  it('formats as zero-padded YYYY-MM-DD', () => {
    expect(getConcertDateKey(new Date('2026-01-05T17:00:00Z'), NYC)).toBe('2026-01-05');
  });

  it('files an LA show on its own night, not the following day', () => {
    // The regression this whole change exists for: a 9pm Friday show in Los
    // Angeles must appear under Friday, not Saturday. Keyed in NYC — the old
    // hardcoded behaviour — it lands a day late and disappears from the
    // Friday filter and the Friday bar of the night strip.
    expect(getConcertDateKey(new Date(LA_SHOW), LA)).toBe('2026-08-19');
    expect(getConcertDateKey(new Date(LA_SHOW), NYC)).toBe('2026-08-20');
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
  it('renders the instant in the venue timezone', () => {
    const label = formatConcertDateTime('2026-08-14T02:00:00Z', NYC);
    // 22:00 EDT on the 13th, not 02:00 UTC on the 14th.
    expect(label).toContain('Aug 13');
    expect(label).toContain('10:00');
  });

  it('shows an LA show at its door time, whoever is reading', () => {
    // 9pm is what the ticket says and what the venue's door says. This is the
    // assertion that would have caught the original bug.
    const label = formatConcertDateTime(LA_SHOW, LA);
    expect(label).toContain('9:00');
    expect(label).toContain('Aug 19');
    expect(label).not.toContain('Aug 20');
  });

  it('falls back rather than throwing on an unusable timezone', () => {
    // Intl throws a RangeError on an unknown IANA zone. A show at the wrong
    // hour is recoverable; a screen that will not render is not.
    expect(() => formatConcertDateTime(LA_SHOW, 'Not/AZone')).not.toThrow();
  });
});

describe('formatTimeZoneAbbreviation', () => {
  it('names the venue clock, so a cross-country time is not ambiguous', () => {
    expect(formatTimeZoneAbbreviation(LA_SHOW, LA)).toBe('PDT');
    expect(formatTimeZoneAbbreviation(LA_SHOW, NYC)).toBe('EDT');
  });
});
