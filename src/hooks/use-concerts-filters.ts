import { useMemo, useState } from 'react';

import { isPointInMultiPolygon } from '@/lib/geo';
import { formatWeekRangeLabel, getNycDateKey } from '@/lib/format-date';
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

export function useConcertsFilters(concerts: Concert[], city: City) {
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

  const selectedBorough = city.boroughs?.find((borough) => borough.id === boroughId) ?? null;

  // Computed fresh each render (cheap — a handful of Date operations, not
  // worth memoizing) so the week label/boundaries never go stale the way a
  // useMemo(() => new Date(), []) would.
  const { weekStart, weekEnd } = getWeekWindow(weekOffset, new Date());
  const weekLabel =
    weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : formatWeekRangeLabel(weekStart, weekEnd);

  const filteredConcerts = useMemo(() => {
    // Deliberately not a dependency: a fresh Date() here would otherwise
    // need to be a memo dependency, which — being a new object identity
    // every render — would defeat the memoization entirely.
    const now = new Date();
    return concerts.filter((concert) => {
      if (!matchesCategory(concert, category, now, weekOffset)) return false;
      if (selectedBorough && !isWithinBorough(concert, selectedBorough)) return false;
      if (dateKey) return getNycDateKey(new Date(concert.startDateTime)) === dateKey;
      return isWithinActiveWindow(concert, category, weekOffset, now);
    });
  }, [concerts, category, selectedBorough, dateKey, weekOffset]);

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
    weekNavRelevant: category !== 'Pop-ups' && dateKey === null,
    filteredConcerts,
  };
}
