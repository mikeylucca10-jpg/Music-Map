import { isLikelyElectronic, pickImageForWidth, type TicketmasterImage } from '@/services/ticketmaster';

// The size ladder a real Ticketmaster event returns, deliberately in the
// unsorted order the API actually uses — the 305px thumbnail really does come
// before the 2426px original in the live response, which is the whole reason
// this function exists rather than reading images[0].
const LADDER: TicketmasterImage[] = [
  { url: 'w100', width: 100, height: 56 },
  { url: 'w305', width: 305, height: 225 },
  { url: 'w2426', width: 2426, height: 1365 },
  { url: 'w640', width: 640, height: 360 },
  { url: 'w1024', width: 1024, height: 576 },
  { url: 'w205', width: 205, height: 115 },
  { url: 'w1136', width: 1136, height: 639 },
  { url: 'w2048', width: 2048, height: 1152 },
];

describe('pickImageForWidth', () => {
  it('takes the smallest image that still covers the target', () => {
    // 720 = the shipped setting (360pt display x 2). 1024 is the first rung
    // above it; 640 would be under-resolution.
    expect(pickImageForWidth(LADDER, 720)).toBe('w1024');
  });

  it('does not overshoot to the largest available', () => {
    // The previous rule always returned w2426 here. That is 537KB measured,
    // against roughly 157KB for w1024, for a card about 360pt wide.
    expect(pickImageForWidth(LADDER, 720)).not.toBe('w2426');
  });

  it('never returns a thumbnail while something clears the target', () => {
    // The failure mode that made "largest" attractive in the first place:
    // images[0] is a 100px thumbnail and must never win.
    for (const target of [200, 400, 720, 1200]) {
      const picked = pickImageForWidth(LADDER, target);
      const width = LADDER.find((image) => image.url === picked)?.width ?? 0;
      expect(width).toBeGreaterThanOrEqual(target);
    }
  });

  it('falls back to the largest when nothing reaches the target', () => {
    expect(pickImageForWidth(LADDER, 5000)).toBe('w2426');
  });

  it('picks an exact match rather than the next rung up', () => {
    expect(pickImageForWidth(LADDER, 1024)).toBe('w1024');
  });

  it('returns undefined for missing or empty input', () => {
    expect(pickImageForWidth(undefined, 720)).toBeUndefined();
    expect(pickImageForWidth([], 720)).toBeUndefined();
  });

  it('treats images with no dimensions as too small rather than crashing', () => {
    const images: TicketmasterImage[] = [{ url: 'unknown' }, { url: 'w640', width: 640, height: 360 }];
    expect(pickImageForWidth(images, 500)).toBe('w640');
    // Nothing clears the target, so the fallback runs; the sized one still
    // beats the dimensionless one on area.
    expect(pickImageForWidth(images, 5000)).toBe('w640');
  });
});

// Every case below is a real act from the live NYC feed, with the exact
// classification Ticketmaster returned for it. The point of the rule is that
// neither field works alone: `genre` alone drops real acts, `subGenre` alone is
// wrong too often to trust.
describe('isLikelyElectronic', () => {
  const of = (genre: string, subGenre?: string) => [{ genre, subGenre }];

  it('drops the arena acts that flood the feed', () => {
    // 30 of 85 listings in one residency — the single worst offender.
    expect(isLikelyElectronic(of('Pop', 'Pop'))).toBe(false); // Harry Styles
    expect(isLikelyElectronic(of('R&B', 'R&B'))).toBe(false); // Sid Sriram
    expect(isLikelyElectronic(of('Hip-Hop/Rap', 'Trap'))).toBe(false); // Bryson Tiller
    expect(isLikelyElectronic(of('Rock', 'Rock'))).toBe(false); // DDXS
    expect(isLikelyElectronic(of('Rock', 'Pop'))).toBe(false); // Arlo
    expect(isLikelyElectronic(of('Jazz', 'Jazz'))).toBe(false); // Harper
  });

  it('rescues electronic acts whose top-level genre says Pop', () => {
    // Galantis, Bolden., Lenny Pearce, Stan Society all arrive as Pop. Judging
    // on genre alone would drop them alongside Harry Styles.
    expect(isLikelyElectronic(of('Pop', 'Electro Pop'))).toBe(true);
    expect(isLikelyElectronic(of('Pop', 'Club Dance'))).toBe(true);
  });

  it('leaves the Other bucket alone', () => {
    // Bicep, Black Coffee, San Holo, Jason Ross, DJ Pauly D, NOTD, French 79
    // and Nitzer Ebb are all Other/Other. Narrowing to Dance/Electronic would
    // lose about ten real acts to catch seven bad ones.
    expect(isLikelyElectronic(of('Other', 'Other'))).toBe(true);
    expect(isLikelyElectronic(of('Other', undefined))).toBe(true);
  });

  it('keeps anything already tagged Dance/Electronic', () => {
    expect(isLikelyElectronic(of('Dance/Electronic', 'Dance/Electronic'))).toBe(true);
    // Amapiano is a real electronic genre, even though the feed also applies
    // the tag to a progressive-house DJ and a jazz duo.
    expect(isLikelyElectronic(of('Dance/Electronic', 'Amapiano'))).toBe(true);
  });

  it('keeps events with no classification data', () => {
    // Absence of evidence is not evidence that a show is Harry Styles.
    expect(isLikelyElectronic(undefined)).toBe(true);
    expect(isLikelyElectronic([])).toBe(true);
    expect(isLikelyElectronic([{}])).toBe(true);
  });

  it('keeps an event if any one of several classifications is electronic', () => {
    expect(isLikelyElectronic([{ genre: 'Pop', subGenre: 'Pop' }, { genre: 'Dance/Electronic' }])).toBe(true);
  });

  it('never uses subGenre as evidence against an event', () => {
    // The same show comes back Other on one listing and Amapiano on another,
    // so a wrong subGenre must not be able to remove a show on its own.
    expect(isLikelyElectronic(of('Dance/Electronic', 'Jazz'))).toBe(true);
    expect(isLikelyElectronic(of('Other', 'Rock'))).toBe(true);
  });
});

// Multi-classification handling, which is what actually decides most cases.
// Ticketmaster attaches up to four classifications per event and the first is
// often the least representative, so these are real events from the live feed.
describe('isLikelyElectronic across multiple classifications', () => {
  it('keeps an event whose electronic tag is not the first one', () => {
    // "Harper, Chloe Southern, lionheart 5000, 1-800 girlfriend" at Night Club
    // 101 — leads with Jazz, but is also tagged Dance/Electronic/Ambient.
    expect(
      isLikelyElectronic([
        { genre: 'Jazz', subGenre: 'Jazz' },
        { genre: 'Folk', subGenre: 'Alternative Folk' },
        { genre: 'Dance/Electronic', subGenre: 'Ambient' },
        { genre: 'Dance/Electronic' },
      ]),
    ).toBe(true);

    // DDXS w/ Stereomatic at Sony Hall — leads with Rock, also tagged
    // Dance/Electronic/Experimental Electro.
    expect(
      isLikelyElectronic([
        { genre: 'Rock', subGenre: 'Rock' },
        { genre: 'Dance/Electronic', subGenre: 'Experimental Electro' },
      ]),
    ).toBe(true);
  });

  it('drops only when no classification is electronic', () => {
    // The four acts actually removed from the live feed each carry exactly one
    // classification, and it is unambiguous.
    expect(isLikelyElectronic([{ genre: 'Pop', subGenre: 'Pop' }])).toBe(false);
    expect(isLikelyElectronic([{ genre: 'Hip-Hop/Rap', subGenre: 'Trap' }])).toBe(false);
    expect(isLikelyElectronic([{ genre: 'Rock', subGenre: 'Pop' }])).toBe(false);
    expect(isLikelyElectronic([{ genre: 'R&B', subGenre: 'R&B' }])).toBe(false);
  });
});

// Why the normalizer judges on the *artist's* classification before the
// event's. These are the exact tags the live feed returned on 2026-08-17, the
// day the event tags drifted and the previous rule stopped working.
describe('isLikelyElectronic on artist vs event classifications', () => {
  it('event tags alone cannot separate Harry Styles from Galantis', () => {
    // Both arrived as Pop / Electro Pop on the same day. Every Pop listing in
    // the feed carried Electro Pop, so the subGenre rescue kept all of them —
    // which is how a 31-date arena residency got back to the top of an EDM app.
    const eventTag = [{ genre: 'Pop', subGenre: 'Electro Pop' }];
    expect(isLikelyElectronic(eventTag)).toBe(true); // Harry Styles: wrong
    expect(isLikelyElectronic(eventTag)).toBe(true); // Galantis: right
  });

  it('artist tags do separate them', () => {
    // An artist has one genre; an event tag is a per-listing guess that gets
    // edited. These held steady while the event tags moved.
    expect(isLikelyElectronic([{ genre: 'Pop', subGenre: 'Pop Rock' }])).toBe(false); // Harry Styles
    expect(isLikelyElectronic([{ genre: 'Dance/Electronic', subGenre: 'Dance/Electronic' }])).toBe(
      true,
    ); // Galantis
    expect(isLikelyElectronic([{ genre: 'Dance/Electronic', subGenre: 'Jazz-House' }])).toBe(true); // Bolden.
  });

  it('still drops the acts that were never ambiguous', () => {
    expect(isLikelyElectronic([{ genre: 'Hip-Hop/Rap', subGenre: 'Hip-Hop/Rap' }])).toBe(false);
    expect(isLikelyElectronic([{ genre: 'R&B', subGenre: 'R&B' }])).toBe(false);
  });
});
