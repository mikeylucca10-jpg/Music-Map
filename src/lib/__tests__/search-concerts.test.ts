import { searchConcerts, topSuggestions } from '@/lib/search-concerts';
import { Concert } from '@/types/concert';

function concert(overrides: Partial<Concert> & { id: string }): Concert {
  return {
    source: 'ticketmaster',
    name: 'Untitled',
    url: 'https://example.com',
    startDateTime: '2026-09-01T23:00:00Z',
    venueName: 'Somewhere',
    address: '1 Street, New York, NY',
    latitude: 40.7,
    longitude: -74,
    ...overrides,
  };
}

const CONCERTS: Concert[] = [
  concert({ id: 'a', artist: 'Bicep', venueName: 'Brooklyn Steel', startDateTime: '2026-09-10T23:00:00Z' }),
  concert({ id: 'b', artist: 'Kölsch', venueName: 'Webster Hall', startDateTime: '2026-09-02T23:00:00Z' }),
  concert({ id: 'c', name: 'Webster Hall presents: Late', venueName: 'Night Club 101', startDateTime: '2026-09-03T23:00:00Z' }),
  concert({ id: 'd', artist: 'Four Tet', venueName: 'Webster Hall', startDateTime: '2026-09-01T23:00:00Z' }),
];

describe('searchConcerts', () => {
  it('returns nothing for an empty or whitespace query', () => {
    // Not "everything": an empty box means the person has not asked yet, and
    // dumping the whole catalogue would bury the suggestions the screen shows
    // instead.
    expect(searchConcerts(CONCERTS, '')).toEqual([]);
    expect(searchConcerts(CONCERTS, '   ')).toEqual([]);
  });

  it('matches on artist, venue and event name', () => {
    expect(searchConcerts(CONCERTS, 'bicep').map((c) => c.id)).toEqual(['a']);
    expect(searchConcerts(CONCERTS, 'brooklyn steel').map((c) => c.id)).toEqual(['a']);
    expect(searchConcerts(CONCERTS, 'late').map((c) => c.id)).toEqual(['c']);
  });

  it('finds accented names typed without accents', () => {
    // "Kölsch" is unreachable from a phone keyboard without this, and
    // electronic line-ups are full of names like it.
    expect(searchConcerts(CONCERTS, 'kolsch').map((c) => c.id)).toEqual(['b']);
  });

  it('ranks a venue whose name starts with the query above a title that merely contains it', () => {
    // Typing "webster" means Webster Hall. The event at Night Club 101 whose
    // *title* happens to say "Webster Hall presents" must not outrank the two
    // shows actually at that venue.
    const ids = searchConcerts(CONCERTS, 'webster').map((c) => c.id);
    expect(ids).toEqual(['d', 'b', 'c']);
  });

  it('breaks ties by date, soonest first', () => {
    // 'd' is Sep 1 and 'b' is Sep 2; both are venue-starts matches, so the
    // sooner one leads because it is the more actionable result.
    const ids = searchConcerts(CONCERTS, 'webster hall').map((c) => c.id);
    expect(ids.slice(0, 2)).toEqual(['d', 'b']);
  });

  it('is case insensitive', () => {
    expect(searchConcerts(CONCERTS, 'BICEP').map((c) => c.id)).toEqual(['a']);
  });
});

describe('topSuggestions', () => {
  it('ranks by how many dates each has, venues and artists together', () => {
    const suggestions = topSuggestions(CONCERTS);
    // Webster Hall has two dates and everything else has one, so it leads
    // regardless of whether it is a venue or an artist.
    expect(suggestions[0]).toEqual({ kind: 'venue', name: 'Webster Hall', count: 2 });
  });

  it('respects the limit', () => {
    expect(topSuggestions(CONCERTS, 2)).toHaveLength(2);
  });

  it('skips concerts with no artist rather than inventing one', () => {
    const names = topSuggestions(CONCERTS).map((s) => s.name);
    expect(names).not.toContain(undefined);
    expect(names).not.toContain('');
  });

  it('keeps artists in the list even when every venue has more dates', () => {
    // The real feed: a handful of rooms with 5–10 nights each, and nearly every
    // act with exactly one. One merged sort by count put eight venues under a
    // field that promises "Artists, venues" and never a single artist.
    const busyRooms = ['Room A', 'Room B', 'Room C', 'Room D', 'Room E', 'Room F', 'Room G', 'Room H'];
    const concerts = busyRooms.flatMap((venueName, v) =>
      Array.from({ length: 6 }, (_, i) => ({
        ...CONCERTS[0],
        id: `${v}-${i}`,
        venueName,
        artist: `Act ${v}-${i}`, // every act plays once
      })),
    );
    const suggestions = topSuggestions(concerts, 8);
    const kinds = new Set(suggestions.map((s) => s.kind));
    expect(suggestions).toHaveLength(8);
    expect(kinds.has('artist')).toBe(true);
    expect(kinds.has('venue')).toBe(true);
    // Half the slots are reserved, so it is not a token single artist either.
    expect(suggestions.filter((s) => s.kind === 'artist').length).toBeGreaterThanOrEqual(4);
  });

  it('backfills from the other kind when one bucket is short', () => {
    // Three venues, two artists, limit 8: all five should appear rather than
    // leaving reserved slots empty.
    const suggestions = topSuggestions(CONCERTS, 8);
    const venueCount = new Set(CONCERTS.map((c) => c.venueName)).size;
    const artistCount = new Set(CONCERTS.map((c) => c.artist).filter(Boolean)).size;
    expect(suggestions).toHaveLength(Math.min(8, venueCount + artistCount));
  });
});
