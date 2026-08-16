import {
  getWeekWindow,
  isThisWeekend,
  isWithinActiveWindow,
  matchesCategory,
} from '@/hooks/use-concerts-filters';
import { Concert } from '@/types/concert';

// Thursday, 13 Aug 2026, mid-afternoon. Built from components (not an ISO
// string) so it's local time — the same clock getWeekWindow reads.
const THURSDAY = new Date(2026, 7, 13, 15, 0, 0);

function localIso(year: number, month: number, day: number, hour = 20) {
  return new Date(year, month, day, hour, 0, 0).toISOString();
}

function makeConcert(overrides: Partial<Concert> = {}): Concert {
  return {
    id: 'tm-1',
    source: 'ticketmaster',
    name: 'Test Show',
    url: 'https://example.com',
    startDateTime: localIso(2026, 7, 13),
    venueName: 'Test Venue',
    address: '1 Test St, New York, NY',
    latitude: 40.7505,
    longitude: -73.9934,
    ...overrides,
  };
}

describe('getWeekWindow', () => {
  it('scopes a Thursday to its Monday-Sunday week', () => {
    const { weekStart, weekEnd } = getWeekWindow(0, THURSDAY);
    expect(weekStart.getDate()).toBe(10);
    expect(weekEnd.getDate()).toBe(16);
  });

  it('always starts on a Monday and ends on a Sunday, whatever day it is run', () => {
    for (let dayOfMonth = 10; dayOfMonth <= 16; dayOfMonth++) {
      const now = new Date(2026, 7, dayOfMonth, 12, 0, 0);
      const { weekStart, weekEnd } = getWeekWindow(0, now);
      expect(weekStart.getDay()).toBe(1);
      expect(weekEnd.getDay()).toBe(0);
      // Every day of that week resolves to the same window.
      expect(weekStart.getDate()).toBe(10);
      expect(weekEnd.getDate()).toBe(16);
    }
  });

  it('covers the whole day at both ends', () => {
    const { weekStart, weekEnd } = getWeekWindow(0, THURSDAY);
    expect(weekStart.getHours()).toBe(0);
    expect(weekStart.getMinutes()).toBe(0);
    expect(weekEnd.getHours()).toBe(23);
    expect(weekEnd.getMinutes()).toBe(59);
  });

  it('pages forward a week at a time', () => {
    expect(getWeekWindow(1, THURSDAY).weekStart.getDate()).toBe(17);
    expect(getWeekWindow(2, THURSDAY).weekStart.getDate()).toBe(24);
  });
});

describe('isThisWeekend', () => {
  it('includes Friday through Sunday of the current week', () => {
    expect(isThisWeekend(localIso(2026, 7, 14), THURSDAY, 0)).toBe(true);
    expect(isThisWeekend(localIso(2026, 7, 15), THURSDAY, 0)).toBe(true);
    expect(isThisWeekend(localIso(2026, 7, 16), THURSDAY, 0)).toBe(true);
  });

  it('excludes weekdays', () => {
    expect(isThisWeekend(localIso(2026, 7, 13), THURSDAY, 0)).toBe(false);
    expect(isThisWeekend(localIso(2026, 7, 17), THURSDAY, 0)).toBe(false);
  });

  it('shifts with the week offset so paging weeks also pages the weekend', () => {
    expect(isThisWeekend(localIso(2026, 7, 21), THURSDAY, 1)).toBe(true);
    expect(isThisWeekend(localIso(2026, 7, 14), THURSDAY, 1)).toBe(false);
  });

  // The reason weeks are Monday-Sunday rather than Sunday-Saturday: a
  // Sunday-start week would put Friday/Saturday in one window and Sunday in
  // the next, so "This Weekend" could never be fully visible at once.
  it('never splits a weekend across two week windows, whatever day it is run', () => {
    for (let dayOfMonth = 10; dayOfMonth <= 16; dayOfMonth++) {
      const now = new Date(2026, 7, dayOfMonth, 12, 0, 0);
      const { weekStart, weekEnd } = getWeekWindow(0, now);

      for (let candidate = 3; candidate <= 24; candidate++) {
        const iso = localIso(2026, 7, candidate);
        if (!isThisWeekend(iso, now, 0)) continue;
        const date = new Date(iso);
        expect(date.getTime()).toBeGreaterThanOrEqual(weekStart.getTime());
        expect(date.getTime()).toBeLessThanOrEqual(weekEnd.getTime());
      }
    }
  });
});

describe('isWithinActiveWindow', () => {
  const laterThisMonth = makeConcert({ startDateTime: localIso(2026, 7, 25) });
  const nextMonth = makeConcert({ startDateTime: localIso(2026, 8, 5) });

  it('scopes normal categories to the current week', () => {
    expect(isWithinActiveWindow(makeConcert(), 'All', 0, THURSDAY)).toBe(true);
    expect(isWithinActiveWindow(laterThisMonth, 'All', 0, THURSDAY)).toBe(false);
  });

  it('scopes Pop-ups to the whole calendar month instead', () => {
    // Pop-ups are sparse enough that a one-week window usually comes up empty.
    expect(isWithinActiveWindow(laterThisMonth, 'Pop-ups', 0, THURSDAY)).toBe(true);
    expect(isWithinActiveWindow(nextMonth, 'Pop-ups', 0, THURSDAY)).toBe(false);
  });
});

describe('matchesCategory', () => {
  it('matches the real API-backed fields', () => {
    expect(matchesCategory(makeConcert({ is21Plus: true }), '21+', THURSDAY, 0)).toBe(true);
    expect(matchesCategory(makeConcert({ is21Plus: false }), '21+', THURSDAY, 0)).toBe(false);
    expect(matchesCategory(makeConcert({ isFree: true }), 'Free', THURSDAY, 0)).toBe(true);
    expect(matchesCategory(makeConcert(), 'Free', THURSDAY, 0)).toBe(false);
  });

  it('lets everything through on All', () => {
    expect(matchesCategory(makeConcert(), 'All', THURSDAY, 0)).toBe(true);
  });

  // These four are documented best-effort keyword matches, not real fields —
  // pinned here so a regex tweak has to be deliberate.
  it('keyword-matches against the concert and venue name', () => {
    expect(matchesCategory(makeConcert({ name: 'Summer Fest 2026' }), 'Festivals', THURSDAY, 0)).toBe(
      true,
    );
    expect(matchesCategory(makeConcert({ name: 'Rooftop Pop-Up' }), 'Pop-ups', THURSDAY, 0)).toBe(
      true,
    );
    expect(matchesCategory(makeConcert({ name: 'Sunday Day Party' }), 'Day Parties', THURSDAY, 0)).toBe(
      true,
    );
    expect(matchesCategory(makeConcert({ venueName: 'Club Space' }), 'Clubs', THURSDAY, 0)).toBe(true);
    expect(matchesCategory(makeConcert({ name: 'Regular Show' }), 'Festivals', THURSDAY, 0)).toBe(
      false,
    );
  });
});
