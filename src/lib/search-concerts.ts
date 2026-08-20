import { Concert } from '@/types/concert';

/**
 * Fold accents and case so "Röyksopp" is reachable by typing "roy".
 *
 * Electronic line-ups are full of names people cannot easily type — Ámbar,
 * Kölsch, Sébastien — and a search that only matches the exact glyphs makes
 * those acts effectively unreachable from a phone keyboard.
 */
function normalise(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Where a match landed, which is the whole basis of the ranking below.
 *
 * Deliberately ordered by how confident the match is rather than by field
 * importance. Someone typing "web" almost certainly means Webster Hall, and
 * a venue whose name *starts* with the query is a far stronger signal than an
 * event title that merely contains it somewhere in a long promoter string.
 */
const RANK = {
  artistStarts: 0,
  venueStarts: 1,
  nameStarts: 2,
  artistContains: 3,
  venueContains: 4,
  nameContains: 5,
} as const;

function scoreConcert(concert: Concert, query: string): number | null {
  const artist = concert.artist ? normalise(concert.artist) : '';
  const venue = normalise(concert.venueName);
  const name = normalise(concert.name);

  if (artist.startsWith(query)) return RANK.artistStarts;
  if (venue.startsWith(query)) return RANK.venueStarts;
  if (name.startsWith(query)) return RANK.nameStarts;
  if (artist.includes(query)) return RANK.artistContains;
  if (venue.includes(query)) return RANK.venueContains;
  if (name.includes(query)) return RANK.nameContains;
  return null;
}

/**
 * Free-text search across the loaded listings.
 *
 * Runs entirely on what the app already has rather than hitting the network.
 * A city's feed is on the order of a hundred shows, so filtering it is
 * instant and works offline from the cache — a request per keystroke would be
 * slower, cost quota, and fail on a bad connection, for no better answer.
 *
 * Deliberately **not** scoped to the visible week or any active filter. Search
 * is what someone reaches for when browsing has failed them; narrowing it by
 * the filters they are already looking past would reproduce the dead end they
 * are trying to escape. A show four weeks out should be findable by name.
 *
 * Ties break by date, soonest first, so the most actionable result leads.
 */
export function searchConcerts(concerts: Concert[], rawQuery: string): Concert[] {
  const query = normalise(rawQuery);
  if (!query) return [];

  const scored: { concert: Concert; rank: number }[] = [];
  for (const concert of concerts) {
    const rank = scoreConcert(concert, query);
    if (rank !== null) scored.push({ concert, rank });
  }

  return scored
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        new Date(a.concert.startDateTime).getTime() - new Date(b.concert.startDateTime).getTime(),
    )
    .map((entry) => entry.concert);
}

export type SearchSuggestion = {
  kind: 'artist' | 'venue';
  name: string;
  count: number;
};

/**
 * What to offer before anything is typed.
 *
 * An empty search screen is a dead end and a blank text field asks a question
 * most people cannot answer — nobody opening this knows which acts are in town
 * this week. Offering the busiest rooms and the acts with the most dates turns
 * the empty state into a starting point, and it is the only ranking signal the
 * feed actually carries: there is no popularity field, but "playing four nights
 * this week" is a real statement about how active something is.
 */
export function topSuggestions(concerts: Concert[], limit = 8): SearchSuggestion[] {
  const artists = new Map<string, number>();
  const venues = new Map<string, number>();

  for (const concert of concerts) {
    venues.set(concert.venueName, (venues.get(concert.venueName) ?? 0) + 1);
    if (concert.artist) artists.set(concert.artist, (artists.get(concert.artist) ?? 0) + 1);
  }

  const build = (counts: Map<string, number>, kind: 'artist' | 'venue'): SearchSuggestion[] =>
    [...counts.entries()].map(([name, count]) => ({ kind, name, count }));

  // Venues and artists are interleaved by count rather than shown as two
  // separate lists. The question being answered is "what is worth tapping",
  // and a room with six nights on beats an artist with one whichever bucket
  // they fall in.
  return [...build(venues, 'venue'), ...build(artists, 'artist')]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
