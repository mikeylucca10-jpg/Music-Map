/**
 * The strip and the list must agree about which week a show is in.
 *
 * They did not. `weekNights` buckets by the venue's calendar while
 * `isWithinActiveWindow` compared the raw instant against boundaries built from
 * the viewer's device clock, so a New York device browsing Los Angeles
 * contradicted itself in both directions — and the only recovery was tapping
 * the exact bar, which routes through the venue-zone branch.
 *
 * Written against the venue's calendar deliberately: it asserts the two paths
 * agree, not that either produces a particular instant. That is the invariant
 * worth defending, and an instant-based test is what let this through.
 */
import { getWeekWindow, isWithinActiveWindow } from '@/hooks/use-concerts-filters';
import { dateKeyFor, getConcertDateKey } from '@/lib/format-date';
import { CITIES, Concert } from '@/types/concert';

const LA_TZ = 'America/Los_Angeles';
const LA = CITIES.find((city) => city.id === 'la')!;

function laConcert(startIso: string): Concert {
  return {
    id: 'tm-la-1',
    source: 'ticketmaster',
    name: 'Sunday Late Set',
    url: 'https://example.com',
    startDateTime: startIso,
    venueName: 'Exchange LA',
    address: '618 S Spring St, Los Angeles, CA',
    latitude: 34.0453,
    longitude: -118.2519,
    timezone: LA_TZ,
  };
}

/** Mirrors the weekNights memo — the calendar the strip actually draws. */
function stripKeys(weekOffset: number, now: Date) {
  const { weekStart } = getWeekWindow(weekOffset, now);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return dateKeyFor(date.getFullYear(), date.getMonth(), date.getDate());
  });
}

describe('week window agrees with the night strip across timezones', () => {
  // Wednesday 26 Aug 2026, midday on the device.
  const now = new Date(2026, 7, 26, 12, 0, 0);

  it('a late Sunday LA show is both counted by the strip and kept by the list', () => {
    // Sunday 30 Aug, 9:00 PM PDT. Past Sunday 23:59 in New York, which is what
    // used to drop it — and 9pm is squarely inside what this app is for.
    const concert = laConcert('2026-08-31T04:00:00.000Z');
    const key = getConcertDateKey(new Date(concert.startDateTime), LA_TZ);

    expect(key).toBe('2026-08-30');
    expect(stripKeys(0, now)).toContain(key);
    expect(isWithinActiveWindow(concert, 0, now, LA.timezone)).toBe(true);
  });

  it('a show on the previous Sunday is excluded, matching the absent bar', () => {
    // Sunday 23 Aug, 9:30 PM PDT — the mirror leak. It was listed with no bar
    // in the strip accounting for it.
    const leaked = laConcert('2026-08-24T04:30:00.000Z');
    const key = getConcertDateKey(new Date(leaked.startDateTime), LA_TZ);

    expect(stripKeys(0, now)).not.toContain(key);
    expect(isWithinActiveWindow(leaked, 0, now, LA.timezone)).toBe(false);
  });

  it('every night the strip draws is a night the list would keep', () => {
    // The general invariant rather than two sampled instants: one show at 9pm
    // venue-time on each of the seven bars must survive the window.
    for (const key of stripKeys(0, now)) {
      const [year, month, day] = key.split('-').map(Number);
      // 21:00 PDT is 04:00 UTC the following day — the offset that broke it.
      const instant = new Date(Date.UTC(year, month - 1, day + 1, 4, 0, 0)).toISOString();
      const concert = laConcert(instant);

      expect(getConcertDateKey(new Date(instant), LA_TZ)).toBe(key);
      expect(isWithinActiveWindow(concert, 0, now, LA.timezone)).toBe(true);
    }
  });
});
