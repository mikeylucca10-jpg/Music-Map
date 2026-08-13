import { useMemo, useState } from 'react';

import { Concert } from '@/types/concert';

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

function isThisWeekend(startDateTime: string, now: Date) {
  const date = new Date(startDateTime);
  const day = now.getDay();
  // Days since the most recent Friday (Fri=0, Sat=1, Sun=2, Mon=3, ... Thu=6).
  const daysSinceFriday = (day + 2) % 7;
  const fridayStart = new Date(now);
  fridayStart.setDate(
    now.getDate() + (daysSinceFriday <= 2 ? -daysSinceFriday : 7 - daysSinceFriday),
  );
  fridayStart.setHours(0, 0, 0, 0);
  const sundayEnd = new Date(fridayStart);
  sundayEnd.setDate(fridayStart.getDate() + 2);
  sundayEnd.setHours(23, 59, 59, 999);
  return date >= fridayStart && date <= sundayEnd;
}

function matchesCategory(concert: Concert, category: Category, now: Date) {
  switch (category) {
    case 'All':
      return true;
    case 'This Weekend':
      return isThisWeekend(concert.startDateTime, now);
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

export function useConcertsFilters(concerts: Concert[]) {
  const [category, setCategory] = useState<Category>('All');

  const filteredConcerts = useMemo(() => {
    const now = new Date();
    return concerts.filter((concert) => matchesCategory(concert, category, now));
  }, [concerts, category]);

  return { category, setCategory, categories: CATEGORIES, filteredConcerts };
}
