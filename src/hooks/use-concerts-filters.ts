import { useMemo } from 'react';

import { useFilterState } from '@/hooks/use-filter-state';

import { getDistanceMiles, isPointInMultiPolygon } from '@/lib/geo';
import {
  dateKeyFor,
  formatDateKeyLabel,
  formatWeekRangeLabel,
  getConcertDateKey,
  DEFAULT_TIME_ZONE,
} from '@/lib/format-date';
import { followKey } from '@/services/follows';
import { City, Concert } from '@/types/concert';

/**
 * Every category answers from a real field or a real clock. None of them guess.
 *
 * Pop-ups, Festivals, Clubs and Day Parties used to sit here as keyword matches
 * against the event title, and measuring them against the live NYC feed showed
 * how badly that worked: Pop-ups matched 0 of 50 shows, Festivals 0, Day
 * Parties 0. Clubs matched 9, but only because the *venue* was called
 * "Night Club 101" or "Blue Note Jazz Club" — it counted a jazz club and missed
 * Pacha, one of the best-known nightclubs in the city. A filter that always
 * returns nothing is worse than no filter, and one that is wrong in both
 * directions is worse still.
 *
 * Day Parties survives because it turned out to be a real question asked the
 * wrong way. Nobody writes "day party" in a title, but a show starting at 3pm
 * is one — 7 of 50 shows start before 5pm, including the Galantis rooftop
 * dates. Late Night replaces the rest for the same reason: 10 of 50 start at
 * 10pm or later, and "what is on after the bars" is the question an electronic
 * listings app is actually for.
 */
export const CATEGORIES = [
  'All',
  'This Weekend',
  'Day Parties',
  'Late Night',
  'Outdoors',
  '21+',
  'Free',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * A day party has finished before most shows have started. 5pm is the cut
 * because the feed's own distribution splits there — a cluster at 12pm–3pm,
 * then nothing until the 5pm–8pm doors bunching.
 */
const DAY_PARTY_ENDS_BEFORE_HOUR = 17;

/** Late night starts at 10pm — after which the listing is a club night, not a gig. */
const LATE_NIGHT_STARTS_AT_HOUR = 22;

/**
 * Venues that are not rooms: rooftops, piers, parks, boats.
 *
 * This is what the old Pop-ups category was reaching for and missing. Nobody
 * writes "pop-up" in an event title — it matched 0 of 50 shows — but the venue
 * name says it plainly, and a rooftop or a boat party is exactly the "not a
 * normal club night" event people were looking for. In a New York summer it is
 * a large share of what is worth going to.
 *
 * Matched on the venue rather than the title, which is the reason it works
 * where the old rules did not. An event title is written fresh by a promoter
 * every week and says whatever they felt like; a venue name is stable, and it
 * is the same string every time that venue appears.
 *
 * Measured against the live NYC feed: 23 of 85 shows, with no false positives
 * and no misses — The Rooftop at Pier 17, Under the 'K' Bridge Park, Circle
 * Line Cruises at Pier 83 and SummerStage all match, while every indoor room
 * (Brooklyn Steel, Webster Hall, Terminal 5, Barclays) does not.
 *
 * Expect this to fall toward zero in winter, which is correct rather than
 * broken — there are no rooftop parties in February.
 */
const OUTDOOR_DEFINITE =
  /rooftop|\broof\b|open[\s-]?air|outdoor|terrace|\bboat\b|cruise|summerstage|\bpool\b|\blawn\b/i;

/**
 * Words that only *suggest* outdoors, because they are frequently part of a
 * place name rather than a description of the room.
 *
 * Auditing all six cities turned up exactly this failure: "The Fillmore Miami
 * Beach at Jackie Gleason Theater" matched on the "Beach" in Miami Beach, and
 * "Festival Hall At Navy Pier" and "Grand Ballroom at Navy Pier" matched on
 * "Pier" while being indoor rooms inside it. All three are firmly indoors.
 */
const OUTDOOR_MAYBE = /\bpier\b|\bpark\b|beach|garden|\byard\b|bridge|waterfront|\bfield\b/i;

/**
 * Indoor rooms, which veto a merely-suggestive match.
 *
 * Deliberately excludes "club": Encore Beach Club in Las Vegas is an outdoor
 * pool club and belongs in this filter, and vetoing on the word would drop it
 * along with every other open-air club night.
 */
const INDOOR_ROOM =
  /theat(er|re)|\bhall\b|ballroom|conservatory|arena|auditorium|museum|\bcent(er|re)\b|lounge/i;

/**
 * The hour a show starts, on the venue's own clock.
 *
 * Read via Intl rather than Date#getHours, which would answer in the viewer's
 * timezone: browsing Los Angeles from New York would file a 3pm LA day party as
 * a 6pm evening show and drop it out of the filter it belongs in.
 */
function venueStartHour(concert: Concert): number | null {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: concert.timezone ?? DEFAULT_TIME_ZONE,
    }).format(new Date(concert.startDateTime));
    const parsed = Number(hour);
    return Number.isFinite(parsed) ? parsed % 24 : null;
  } catch {
    return null;
  }
}

/**
 * How far away a show can be and still count.
 *
 * A short list, because the useful question is coarse -- walkable, this side
 * of town, or anywhere -- and a slider would invite precision the data does
 * not support. Distances are straight-line: two miles across the East River
 * is a longer trip than two miles down an avenue, and nothing here knows that.
 */
export const DISTANCE_OPTIONS = [1, 3, 5, 10, 25] as const;

const MAX_WEEKS_AHEAD = 8;

/**
 * Whether a show comes from something the viewer follows.
 *
 * Venue follows deliberately match every show in that room, not just ones by
 * artists already followed. That is the whole point of following a venue: a
 * trusted room is how you meet acts you have never heard of, and it is the gap
 * every competitor leaves open by keying discovery on artists alone.
 *
 * Matched on normalised names because no source supplies a stable artist id.
 */
export function matchesFollows(
  concert: Concert,
  followedArtistKeys: Set<string>,
  followedVenueKeys: Set<string>,
) {
  if (followedVenueKeys.has(followKey(concert.venueName))) return true;
  return concert.artist ? followedArtistKeys.has(followKey(concert.artist)) : false;
}

// The helpers below are exported purely so the unit tests can reach them
// (see __tests__/use-concerts-filters.test.ts) — they're pure functions with
// fiddly calendar edge cases, and testing them through the hook would need a
// full React renderer for no added coverage.

// Monday-Sunday, so a weekend (Fri/Sat/Sun) always falls at the end of "its"
// week rather than Sunday spilling into the next Sun-Sat window.
export function getWeekWindow(weekOffset: number, now: Date) {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - daysSinceMonday + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

// Same calendar rule as isWithinActiveWindow, for the same reason. Friday to
// Sunday is a question about the venue's nights, not the viewer's clock: a
// Sunday 10pm show in Los Angeles is Sunday there and Monday in New York, and
// comparing instants dropped it from "This Weekend" for anyone further east —
// the weekend filter losing Sunday nights being about the worst version of
// this bug in an app for late shows.
export function isThisWeekend(
  startDateTime: string,
  now: Date,
  weekOffset: number,
  timeZone: string,
) {
  const day = now.getDay();
  // Days since the most recent Friday (Fri=0, Sat=1, Sun=2, Mon=3, ... Thu=6).
  const daysSinceFriday = (day + 2) % 7;
  const fridayStart = new Date(now);
  fridayStart.setDate(
    now.getDate() + (daysSinceFriday <= 2 ? -daysSinceFriday : 7 - daysSinceFriday) + weekOffset * 7,
  );
  fridayStart.setHours(0, 0, 0, 0);
  const sundayEnd = new Date(fridayStart);
  sundayEnd.setDate(fridayStart.getDate() + 2);

  const fridayKey = dateKeyFor(
    fridayStart.getFullYear(),
    fridayStart.getMonth(),
    fridayStart.getDate(),
  );
  const sundayKey = dateKeyFor(sundayEnd.getFullYear(), sundayEnd.getMonth(), sundayEnd.getDate());
  const concertKey = getConcertDateKey(new Date(startDateTime), timeZone);
  return concertKey >= fridayKey && concertKey <= sundayKey;
}

/**
 * Whether a venue is open air.
 *
 * Read from the venue name only, never the event title — that is the reason
 * this works where the old Pop-ups keyword did not. A promoter rewrites the
 * event name every week and it says whatever they felt like; a venue name is
 * the same string every time that venue appears, so a rule tuned against it
 * stays tuned.
 *
 * Exported for the tests, which pin the real venue names this was audited
 * against across all six cities.
 */
export function isOutdoorVenue(venueName: string): boolean {
  if (OUTDOOR_DEFINITE.test(venueName)) return true;
  return OUTDOOR_MAYBE.test(venueName) && !INDOOR_ROOM.test(venueName);
}

export function matchesCategory(
  concert: Concert,
  category: Category,
  now: Date,
  weekOffset: number,
  fallbackTimeZone: string,
) {
  switch (category) {
    case 'All':
      return true;
    case 'This Weekend':
      return isThisWeekend(
        concert.startDateTime,
        now,
        weekOffset,
        concert.timezone ?? fallbackTimeZone,
      );
    case '21+':
      return concert.is21Plus === true;
    case 'Free':
      return concert.isFree === true;
    case 'Day Parties': {
      const hour = venueStartHour(concert);
      return hour !== null && hour < DAY_PARTY_ENDS_BEFORE_HOUR;
    }
    case 'Late Night': {
      const hour = venueStartHour(concert);
      // The pre-5am arm catches a 1am set, which belongs to the night before in
      // every sense except the calendar's.
      return hour !== null && (hour >= LATE_NIGHT_STARTS_AT_HOUR || hour < 5);
    }
    case 'Outdoors':
      return isOutdoorVenue(concert.venueName);
  }
}

// Everything shows only the current week by default (paged via the strip), so
// opening the app doesn't dump every upcoming show at once.
//
// Pop-ups used to get a whole month here instead of a week, because it was so
// sparse a week was usually empty. It was sparse because it matched nothing at
// all, and with that category gone the exception goes with it — every category
// is now week-scoped, which is one fewer rule and one fewer thing for the week
// navigator to special-case.
// Compared as calendar days in the *venue's* zone, not as an instant against
// device-local midnight.
//
// The instant comparison put two different calendars on one screen. The night
// strip buckets by getConcertDateKey(startDateTime, venue zone), and so does
// the branch that runs once a night is tapped — but this fall-through compared
// the raw instant against boundaries built from the viewer's own clock. A New
// York device browsing Los Angeles therefore disagreed with itself in both
// directions: a Sunday 9pm PDT show was counted on Sunday's bar and excluded
// from the list beneath it, while a show late on the *previous* Sunday was
// listed with no bar accounting for it. The only recovery was tapping the exact
// bar, which routes through the venue-zone branch — a tap nobody has reason to
// think is needed.
//
// It landed hardest on exactly the shows this app is for: weekEnd is Sunday
// 23:59:59 in the viewer's zone, which is 20:59:59 in LA, so every late set
// past 9pm Sunday fell off. Five of the six cities are west of New York.
//
// Date keys are YYYY-MM-DD, so lexical >= and <= are correct calendar
// comparisons and no instant arithmetic is involved. getWeekWindow itself stays
// device-local on purpose: "which week is it now" is a question about the person
// holding the phone, and only the *concert's* side needed the venue's calendar.
export function isWithinActiveWindow(
  concert: Concert,
  weekOffset: number,
  now: Date,
  fallbackTimeZone: string,
) {
  const { weekStart, weekEnd } = getWeekWindow(weekOffset, now);
  const startKey = dateKeyFor(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const endKey = dateKeyFor(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
  const concertKey = getConcertDateKey(
    new Date(concert.startDateTime),
    concert.timezone ?? fallbackTimeZone,
  );
  return concertKey >= startKey && concertKey <= endKey;
}

function isWithinBorough(concert: Concert, borough: NonNullable<City['boroughs']>[number]) {
  return isPointInMultiPolygon(concert.latitude, concert.longitude, borough.boundary);
}

/**
 * @param follows what the signed-in viewer follows. Empty for signed-out
 *   users, which is also why the Following control only renders when this is
 *   non-empty — a filter that can only ever return nothing is worse than absent.
 */
export function useConcertsFilters(
  concerts: Concert[],
  city: City,
  follows: { kind: string; key: string }[] = [],
  /**
   * The viewer's coordinates, when they have granted location.
   *
   * Passed in rather than read from useUserLocation here, so this hook stays
   * free of permission side effects -- mounting a filter hook must never be
   * what triggers an OS dialog.
   */
  userLocation?: { latitude: number; longitude: number } | null,
) {
  // Shared across Home and Explore rather than private to whichever screen
  // called this hook. The two are views of one dataset, and separate copies
  // drifted the moment either was touched — see use-filter-state.tsx.
  const {
    followingOnly,
    setFollowingOnly,
    category,
    setCategory,
    boroughId,
    setBoroughId,
    dateKey,
    setDateKey,
    weekOffset,
    setWeekOffset,
    maxMiles,
    setMaxMiles,
    lastCityId,
    setLastCityId,
  } = useFilterState();

  // Reset the borough selection and week position when the city changes
  // (e.g. NYC -> Vegas) so stale filters don't silently zero out another
  // city's results. This runs during render, not an effect, so it doesn't
  // need the set-state-in-effect eslint-disable used elsewhere in the
  // codebase.
  if (city.id !== lastCityId) {
    setLastCityId(city.id);
    setBoroughId(null);
    setWeekOffset(0);
  }

  const followedArtistKeys = useMemo(
    () => new Set(follows.filter((f) => f.kind === 'artist').map((f) => f.key)),
    [follows],
  );
  const followedVenueKeys = useMemo(
    () => new Set(follows.filter((f) => f.kind === 'venue').map((f) => f.key)),
    [follows],
  );

  const selectedBorough = city.boroughs?.find((borough) => borough.id === boroughId) ?? null;

  /**
   * How many upcoming shows sit in each borough, busiest first.
   *
   * Ordering was previously the dataset's own — Manhattan, Brooklyn, Queens,
   * Bronx, Staten Island — which is alphabetical-ish by borough code and says
   * nothing about where anything is on. Sorting by real counts puts the two
   * boroughs that carry the scene at the top and lets the quiet ones sink on
   * their own, without hard-coding an opinion that goes stale.
   *
   * Counts are of everything loaded rather than the visible week, so a borough
   * does not read as empty because of a filter set somewhere else on the bar.
   * Empty boroughs are kept rather than hidden: "Queens, 0 shows" is a real
   * answer, and silently dropping a borough would look like a missing feature.
   */
  const boroughCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const borough of city.boroughs ?? []) {
      counts.set(
        borough.id,
        concerts.filter((concert) => isWithinBorough(concert, borough)).length,
      );
    }
    return counts;
  }, [concerts, city.boroughs]);

  const boroughsByCount = useMemo(
    () =>
      [...(city.boroughs ?? [])].sort(
        (a, b) =>
          (boroughCounts.get(b.id) ?? 0) - (boroughCounts.get(a.id) ?? 0) ||
          a.label.localeCompare(b.label),
      ),
    [city.boroughs, boroughCounts],
  );

  // Computed fresh each render (cheap — a handful of Date operations, not
  // worth memoizing) so the week label/boundaries never go stale the way a
  // useMemo(() => new Date(), []) would.
  const { weekStart, weekEnd } = getWeekWindow(weekOffset, new Date());
  const weekLabel =
    weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : formatWeekRangeLabel(weekStart, weekEnd);

  // The seven nights of the visible week, each with how many shows land on it.
  //
  // Counts honour category and borough but deliberately ignore `dateKey`:
  // the strip's whole job is to show what *else* is on this week, so scoping it
  // to the night already selected would flatten every other bar to zero and
  // make the control useless the moment it was used.
  //
  // Bars are keyed by the venue's own calendar day, matching how the date
  // filter itself compares, so a late-night show lands on the night people
  // would say it belongs to rather than the viewer's local date. "Today" uses
  // the city's zone instead — that marker is about the city being browsed.
  const weekNights = useMemo(() => {
    const now = new Date();
    const inScope = concerts.filter(
      (concert) =>
        matchesCategory(concert, category, now, weekOffset, city.timezone) &&
        (!selectedBorough || isWithinBorough(concert, selectedBorough)),
    );

    const counts = new Map<string, number>();
    for (const concert of inScope) {
      const key = getConcertDateKey(new Date(concert.startDateTime), concert.timezone ?? city.timezone);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const todayKey = getConcertDateKey(now, city.timezone);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = dateKeyFor(date.getFullYear(), date.getMonth(), date.getDate());
      return { dateKey: key, date, count: counts.get(key) ?? 0, isToday: key === todayKey };
    });
    // weekStart is derived from weekOffset and is a fresh object every render,
    // so weekOffset is the real dependency — listing weekStart would defeat
    // the memo entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concerts, category, selectedBorough, weekOffset]);

  /**
   * The soonest show *after* the visible window, when the window itself is
   * empty — so an empty week can offer a way out instead of dead-ending.
   *
   * Deliberately not auto-advanced to. Jumping the user forward on load would
   * mean the screen shows one week while the rest of the UI still says another,
   * and it fights anyone who paged back to an empty week on purpose. "Nothing
   * on this week" is a real answer; it just needs an exit next to it.
   *
   * Honours category and borough, so the offer never points at a show the
   * current filters would immediately hide.
   */
  const nextShowAhead = useMemo(() => {
    const now = new Date();
    const { weekEnd } = getWeekWindow(weekOffset, now);

    let soonest: Concert | null = null;
    for (const concert of concerts) {
      if (!matchesCategory(concert, category, now, weekOffset, city.timezone)) continue;
      if (selectedBorough && !isWithinBorough(concert, selectedBorough)) continue;
      const date = new Date(concert.startDateTime);
      if (date <= weekEnd) continue;
      if (!soonest || date < new Date(soonest.startDateTime)) soonest = concert;
    }
    if (!soonest) return null;

    // How many weeks forward that show sits, so the jump is one setWeekOffset.
    const { weekStart: currentStart } = getWeekWindow(0, now);
    const showDate = new Date(soonest.startDateTime);
    const weeksAhead = Math.floor(
      (showDate.getTime() - currentStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    return { concert: soonest, weekOffset: Math.min(MAX_WEEKS_AHEAD, Math.max(0, weeksAhead)) };
    // city.timezone is a real dependency now that the category match resolves on
    // the venue's calendar — without it, switching city would keep offering a
    // "next show" computed against the previous city's clock.
  }, [concerts, category, selectedBorough, weekOffset, city.timezone]);

  /**
   * Everything currently narrowing the list, named the way the user chose it.
   *
   * This exists because the pills are an incomplete record of what is applied:
   * City and Date show their own state, but the Filters pill reads "Filters"
   * whether or not a category is set, and the week position is only legible if
   * you happen to look at the strip. Baymard's testing found people open a
   * filter panel purely to re-read what they had selected when the list itself
   * does not say — this is the answer to that, and it also gives the reset
   * control something specific to name rather than a bare "Reset".
   *
   * City is deliberately absent. It is a saved preference seeded from
   * profiles.default_city, not a filter someone applied in this session, so
   * clearing it would fight the user's own default and silently move them to
   * another city's listings. Borough *is* here — that is a real narrowing
   * chosen in-session, even though it is picked from inside the city menu.
   */
  const activeFilters = useMemo(() => {
    const active: { id: string; label: string }[] = [];
    if (category !== 'All') active.push({ id: 'category', label: category });
    if (selectedBorough) active.push({ id: 'borough', label: selectedBorough.label });
    if (dateKey) active.push({ id: 'date', label: formatDateKeyLabel(dateKey) });
    if (followingOnly) active.push({ id: 'following', label: 'Following' });
    // Not "a filter" in the same sense — it narrows by time rather than by a
    // property of a show — but it is the state people most often want undone,
    // and it is the one the request specifically named ("reset to today").
    if (weekOffset !== 0) active.push({ id: 'week', label: 'This week' });
    // Only counted while it can actually do something. A distance set before
    // location was granted would otherwise show in the reset row as an active
    // filter that is changing nothing.
    if (maxMiles !== null && userLocation)
      active.push({ id: 'distance', label: `Within ${maxMiles} mi` });
    return active;
  }, [category, selectedBorough, dateKey, followingOnly, weekOffset, maxMiles, userLocation]);

  const filteredConcerts = useMemo(() => {
    // Deliberately not a dependency: a fresh Date() here would otherwise
    // need to be a memo dependency, which — being a new object identity
    // every render — would defeat the memoization entirely.
    const now = new Date();
    return concerts.filter((concert) => {
      if (!matchesCategory(concert, category, now, weekOffset, city.timezone)) return false;
      if (followingOnly && !matchesFollows(concert, followedArtistKeys, followedVenueKeys))
        return false;
      if (selectedBorough && !isWithinBorough(concert, selectedBorough)) return false;
      // Only applied when there is a location to measure from. Without one the
      // filter is silently dropped rather than returning nothing — a control
      // that empties the list because a permission is missing looks like the
      // app is broken, not like a filter is on.
      if (maxMiles !== null && userLocation) {
        const miles = getDistanceMiles(
          userLocation.latitude,
          userLocation.longitude,
          concert.latitude,
          concert.longitude,
        );
        if (miles > maxMiles) return false;
      }
      if (dateKey)
        return getConcertDateKey(new Date(concert.startDateTime), concert.timezone ?? city.timezone) === dateKey;
      // Both branches now answer on the venue's calendar, so tapping a night
      // and not tapping one are two cases of one comparison rather than two
      // different questions.
      return isWithinActiveWindow(concert, weekOffset, now, city.timezone);
    });
  }, [
    concerts,
    category,
    selectedBorough,
    dateKey,
    weekOffset,
    followingOnly,
    followedArtistKeys,
    followedVenueKeys,
    // Only the fallback for concerts that carry no zone of their own, but it
    // still changes the answer when the city changes, so it belongs here.
    city.timezone,
    maxMiles,
    userLocation,
  ]);

  return {
    category,
    setCategory,
    categories: CATEGORIES,
    boroughs: city.boroughs,
    boroughsByCount,
    boroughCounts,
    selectedBoroughId: boroughId,
    setBoroughId,
    selectedDateKey: dateKey,
    setDateKey,
    weekLabel,
    goToPrevWeek: () => setWeekOffset((offset) => Math.max(0, offset - 1)),
    goToNextWeek: () => setWeekOffset((offset) => Math.min(MAX_WEEKS_AHEAD, offset + 1)),
    // Absolute jump (not relative like goToPrevWeek/goToNextWeek above) —
    // used by the date-picker sheet's "This Week"/"Next Week" quick-select
    // buttons, which always mean exactly offset 0/1 regardless of wherever
    // the week navigator currently is.
    setWeekOffset,
    canGoPrevWeek: weekOffset > 0,
    canGoNextWeek: weekOffset < MAX_WEEKS_AHEAD,
    // The week navigator doesn't apply to Pop-ups (month-scoped instead) or
    // once a specific date is picked (that's a stronger, more specific
    // filter) — the filter bar hides the row in both cases.
    // Pop-ups is month-scoped, so a week strip would misrepresent what is
    // actually being filtered. Unlike the old arrow row this stays visible once
    // a date is picked: the strip is how that date was picked, and how it gets
    // changed or cleared.
    weekNavRelevant: true,
    weekNights,
    followingOnly,
    setFollowingOnly,
    /** Drives whether the Following pill renders at all. */
    followCount: follows.length,
    nextShowAhead,
    /**
     * True when filters are the reason nothing is showing, rather than the
     * dataset being empty. Lets the empty state say which it is instead of
     * claiming there are no shows when 85 of them are loaded.
     */
    hasAnyConcerts: concerts.length > 0,
    maxMiles,
    setMaxMiles,
    /** Whether the distance control can do anything — see userLocation. */
    canFilterByDistance: Boolean(userLocation),
    activeFilters,
    /**
     * Back to the default view: this week, every category, no borough, no
     * night, everyone. One tap, no confirmation — nothing here is destructive
     * or hard to redo, and a dialog guarding a filter reset is friction with
     * no risk behind it.
     *
     * City is left alone on purpose; see activeFilters above for why.
     */
    resetFilters: () => {
      setCategory('All');
      setBoroughId(null);
      setDateKey(null);
      setWeekOffset(0);
      setFollowingOnly(false);
      setMaxMiles(null);
    },
    filteredConcerts,
  };
}
