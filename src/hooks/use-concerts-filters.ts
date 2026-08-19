import { useMemo, useState } from 'react';

import { isPointInMultiPolygon } from '@/lib/geo';
import { dateKeyFor, formatWeekRangeLabel, getNycDateKey } from '@/lib/format-date';
import { followKey } from '@/services/follows';
import { City, Concert } from '@/types/concert';

export const CATEGORIES = [
  'All',
  'This Weekend',
  '21+',
  'Free',
  'Pop-ups',
  'Festivals',
  'Clubs',
  'Day Parties',
] as const;

export type Category = (typeof CATEGORIES)[number];

// These four are best-effort keyword matches, not a real Ticketmaster field —
// some events will be miscategorized or unmatched.
const KEYWORD_MATCHERS: Partial<Record<Category, RegExp>> = {
  'Pop-ups': /pop[\s-]?up/i,
  Festivals: /festival|\bfest\b/i,
  Clubs: /\bclub\b/i,
  'Day Parties': /day[\s-]?part(y|ies)/i,
};

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

function getMonthWindow(now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { monthStart, monthEnd };
}

export function isThisWeekend(startDateTime: string, now: Date, weekOffset: number) {
  const date = new Date(startDateTime);
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
  sundayEnd.setHours(23, 59, 59, 999);
  return date >= fridayStart && date <= sundayEnd;
}

export function matchesCategory(
  concert: Concert,
  category: Category,
  now: Date,
  weekOffset: number,
) {
  switch (category) {
    case 'All':
      return true;
    case 'This Weekend':
      return isThisWeekend(concert.startDateTime, now, weekOffset);
    case '21+':
      return concert.is21Plus === true;
    case 'Free':
      return concert.isFree === true;
    default: {
      const matcher = KEYWORD_MATCHERS[category];
      return matcher ? matcher.test(`${concert.name} ${concert.venueName}`) : false;
    }
  }
}

// Everything defaults to showing only the current week (paged via the week
// navigator) so opening the app doesn't dump every upcoming show at once —
// except Pop-ups, which gets a full month instead of a week since pop-ups
// are sparser and a week window would often come up empty.
export function isWithinActiveWindow(
  concert: Concert,
  category: Category,
  weekOffset: number,
  now: Date,
) {
  const date = new Date(concert.startDateTime);
  if (category === 'Pop-ups') {
    const { monthStart, monthEnd } = getMonthWindow(now);
    return date >= monthStart && date <= monthEnd;
  }
  const { weekStart, weekEnd } = getWeekWindow(weekOffset, now);
  return date >= weekStart && date <= weekEnd;
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
) {
  const [followingOnly, setFollowingOnly] = useState(false);
  const [category, setCategory] = useState<Category>('All');
  const [boroughId, setBoroughId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Reset the borough selection and week position when the city changes
  // (e.g. NYC -> Vegas) so stale filters don't silently zero out another
  // city's results. This runs during render, not an effect, so it doesn't
  // need the set-state-in-effect eslint-disable used elsewhere in the
  // codebase.
  const [lastCityId, setLastCityId] = useState(city.id);
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
  // Bars are keyed by NYC calendar day via getNycDateKey, matching how the date
  // filter itself compares, so a late-night show lands on the night people
  // would say it belongs to rather than the viewer's local date.
  const weekNights = useMemo(() => {
    const now = new Date();
    const inScope = concerts.filter(
      (concert) =>
        matchesCategory(concert, category, now, weekOffset) &&
        (!selectedBorough || isWithinBorough(concert, selectedBorough)),
    );

    const counts = new Map<string, number>();
    for (const concert of inScope) {
      const key = getNycDateKey(new Date(concert.startDateTime));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const todayKey = getNycDateKey(now);
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
      if (!matchesCategory(concert, category, now, weekOffset)) continue;
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
  }, [concerts, category, selectedBorough, weekOffset]);

  const filteredConcerts = useMemo(() => {
    // Deliberately not a dependency: a fresh Date() here would otherwise
    // need to be a memo dependency, which — being a new object identity
    // every render — would defeat the memoization entirely.
    const now = new Date();
    return concerts.filter((concert) => {
      if (!matchesCategory(concert, category, now, weekOffset)) return false;
      if (followingOnly && !matchesFollows(concert, followedArtistKeys, followedVenueKeys))
        return false;
      if (selectedBorough && !isWithinBorough(concert, selectedBorough)) return false;
      if (dateKey) return getNycDateKey(new Date(concert.startDateTime)) === dateKey;
      return isWithinActiveWindow(concert, category, weekOffset, now);
    });
  }, [concerts, category, selectedBorough, dateKey, weekOffset, followingOnly, followedArtistKeys, followedVenueKeys]);

  return {
    category,
    setCategory,
    categories: CATEGORIES,
    boroughs: city.boroughs,
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
    weekNavRelevant: category !== 'Pop-ups',
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
    filteredConcerts,
  };
}
