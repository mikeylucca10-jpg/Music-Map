/**
 * The client-side join between what someone follows and what is on.
 *
 * Untested until now, and its failure mode is the silent one: if this ever
 * drifts from `followKey` — a different trim, a different case rule — the
 * Following filter stops matching anything and simply returns an empty list
 * forever. No error, no crash, and "nothing this week" is a legitimate answer,
 * so nobody would notice. That is the same class of silent drift that
 * poller-parity.test.ts exists to catch on the server side.
 *
 * So these tests deliberately go through `followKey` for the stored side and
 * raw strings for the concert side, which is exactly how the real data arrives:
 * follow keys are normalised when written (services/follows.ts), concert names
 * come straight off the feed unnormalised.
 */
import { matchesFollows } from '@/hooks/use-concerts-filters';
import { followKey } from '@/services/follows';
import { Concert } from '@/types/concert';

function makeConcert(overrides: Partial<Concert> = {}): Concert {
  return {
    id: 'tm-1',
    source: 'ticketmaster',
    name: 'Bicep Live',
    artist: 'Bicep',
    url: 'https://example.com',
    startDateTime: '2026-08-28T23:00:00Z',
    venueName: 'Brooklyn Steel',
    address: '319 Frost St, Brooklyn, NY',
    latitude: 40.7185,
    longitude: -73.9385,
    timezone: 'America/New_York',
    ...overrides,
  };
}

const keys = (...names: string[]) => new Set(names.map(followKey));
const NONE = new Set<string>();

describe('matchesFollows', () => {
  it('matches a followed artist', () => {
    expect(matchesFollows(makeConcert(), keys('Bicep'), NONE)).toBe(true);
  });

  it('matches a followed venue', () => {
    expect(matchesFollows(makeConcert(), NONE, keys('Brooklyn Steel'))).toBe(true);
  });

  it('matches nothing when neither is followed', () => {
    expect(matchesFollows(makeConcert(), keys('Four Tet'), keys('Elsewhere'))).toBe(false);
  });

  it('follows a venue for every act in it, not just followed artists', () => {
    // The whole point of following a room: a trusted venue is how you meet acts
    // you have never heard of. An artist-only join would drop this.
    const unknownAct = makeConcert({ artist: 'Someone You Have Never Heard Of' });
    expect(matchesFollows(unknownAct, NONE, keys('Brooklyn Steel'))).toBe(true);
  });

  it('normalises case and whitespace the same way followKey does', () => {
    // The drift guard. The feed does not promise tidy strings, and the stored
    // side is normalised at write time — if these two ever disagree the filter
    // silently returns nothing.
    const messy = makeConcert({ artist: '  BICEP  ', venueName: 'brooklyn   steel' });
    expect(matchesFollows(messy, keys('Bicep'), NONE)).toBe(true);
    expect(matchesFollows(messy, NONE, keys('Brooklyn Steel'))).toBe(true);
  });

  it('handles a concert with no artist without throwing', () => {
    // Plenty of listings are venue-only or festival-billed; artist is optional
    // on Concert, and an undefined here must be a miss rather than a crash.
    const noArtist = makeConcert({ artist: undefined });
    expect(matchesFollows(noArtist, keys('Bicep'), NONE)).toBe(false);
    expect(matchesFollows(noArtist, NONE, keys('Brooklyn Steel'))).toBe(true);
  });

  it('does not match a different act at a followed-sounding name', () => {
    // Substring matching would be wrong here: "Bicep" must not match "Bicep
    // Tribute Band", because following an artist is a statement about that act.
    const tribute = makeConcert({ artist: 'Bicep Tribute Band' });
    expect(matchesFollows(tribute, keys('Bicep'), NONE)).toBe(false);
  });
});
