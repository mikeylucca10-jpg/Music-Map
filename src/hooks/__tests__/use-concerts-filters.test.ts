import {
  getWeekWindow,
  isThisWeekend,
  isOutdoorVenue,
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

  it('scopes normal categories to the current week', () => {
    expect(isWithinActiveWindow(makeConcert(), 'All', 0, THURSDAY)).toBe(true);
    expect(isWithinActiveWindow(laterThisMonth, 'All', 0, THURSDAY)).toBe(false);
  });

  it('scopes every category to the week, with no exceptions', () => {
    // Pop-ups used to get a whole calendar month here because a week was
    // usually empty for it. It was empty because the keyword matched nothing at
    // all; the category is gone and the exception went with it.
    for (const category of ['All', 'This Weekend', 'Day Parties', 'Late Night', '21+', 'Free'] as const) {
      expect(isWithinActiveWindow(laterThisMonth, category, 0, THURSDAY)).toBe(false);
    }
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

  // Day Parties and Late Night read the clock rather than the title. The
  // keyword versions of these matched 0 of 50 shows against the live feed,
  // because nobody writes "day party" in an event name — but plenty of shows
  // start at 3pm.
  it('classifies by the hour a show starts, in the venue timezone', () => {
    const nycAfternoon = makeConcert({
      // 19:00Z is 3pm in New York.
      startDateTime: '2026-08-20T19:00:00Z',
      timezone: 'America/New_York',
    });
    const nycLate = makeConcert({
      // 03:00Z is 11pm the previous evening in New York.
      startDateTime: '2026-08-21T03:00:00Z',
      timezone: 'America/New_York',
    });
    const nycEvening = makeConcert({
      startDateTime: '2026-08-21T00:00:00Z',
      timezone: 'America/New_York',
    });

    expect(matchesCategory(nycAfternoon, 'Day Parties', THURSDAY, 0)).toBe(true);
    expect(matchesCategory(nycLate, 'Day Parties', THURSDAY, 0)).toBe(false);
    expect(matchesCategory(nycLate, 'Late Night', THURSDAY, 0)).toBe(true);
    expect(matchesCategory(nycEvening, 'Late Night', THURSDAY, 0)).toBe(false);
    expect(matchesCategory(nycEvening, 'Day Parties', THURSDAY, 0)).toBe(false);
  });

  // Outdoors reads the venue, never the title. That is the whole reason it
  // works where the old Pop-ups keyword did not: promoters rewrite event names
  // every week, but a venue name is the same string every time.
  it('matches Outdoors on the venue, not the event title', () => {
    // Every one of these is a real venue name audited from the live feeds of
    // all six cities, so a tweak to the rule has to keep them classified.
    for (const venueName of [
      'The Rooftop at Pier 17',
      "Under the 'K' Bridge Park",
      'Circle Line Cruises, Pier 83',
      'Capital One City Parks Foundation SummerStage',
      'Los Angeles State Historic Park: On The Promenade',
      'Exposition Park',
      'Reframe Studios Outdoors',
      'Navy Pier',
      'The Salt Shed Outdoors (Fairgrounds)',
      // An outdoor pool club. "Club" is deliberately not an indoor veto word,
      // or every open-air club night in Las Vegas would be excluded.
      'Encore Beach Club',
    ]) {
      expect(isOutdoorVenue(venueName)).toBe(true);
    }

    for (const venueName of [
      'Brooklyn Steel',
      'Webster Hall',
      'Terminal 5',
      'Barclays Center',
      'Night Club 101',
      'Bowery Ballroom',
    ]) {
      expect(isOutdoorVenue(venueName)).toBe(false);
    }
  });

  // These three all matched before the audit and are all firmly indoors. A
  // place name containing "Beach", "Pier" or "Park" says nothing about whether
  // the room has a roof.
  it('does not treat an indoor room inside an outdoor place as outdoors', () => {
    for (const venueName of [
      'The Fillmore Miami Beach at Jackie Gleason Theater',
      'Festival Hall At Navy Pier',
      'Grand Ballroom at Navy Pier',
      'Garfield Park Conservatory',
    ]) {
      expect(isOutdoorVenue(venueName)).toBe(false);
    }
  });

  it('lets an explicit outdoor word beat an indoor one', () => {
    // "Rooftop" is definite, so it wins even next to a room word — the reverse
    // would exclude a genuine rooftop bar attached to a theatre.
    expect(isOutdoorVenue('The Rooftop at the Wiltern Theatre')).toBe(true);
  });

  it('does not let an event title fake an Outdoors match', () => {
    // "Rooftop Vibes" at an indoor club is not an outdoor show.
    expect(
      matchesCategory(
        makeConcert({ name: 'Rooftop Vibes Tour', venueName: 'Webster Hall' }),
        'Outdoors',
        THURSDAY,
        0,
      ),
    ).toBe(false);
  });

  it('reads the hour in the venue zone rather than the viewer zone', () => {
    // The same instant is a 3pm day party in Los Angeles and a 6pm evening show
    // in New York. Using Date#getHours would classify it by whoever is looking.
    const laAfternoon = makeConcert({
      startDateTime: '2026-08-20T22:00:00Z',
      timezone: 'America/Los_Angeles',
    });
    const nycEvening = makeConcert({
      startDateTime: '2026-08-20T22:00:00Z',
      timezone: 'America/New_York',
    });
    expect(matchesCategory(laAfternoon, 'Day Parties', THURSDAY, 0)).toBe(true);
    expect(matchesCategory(nycEvening, 'Day Parties', THURSDAY, 0)).toBe(false);
  });
});
