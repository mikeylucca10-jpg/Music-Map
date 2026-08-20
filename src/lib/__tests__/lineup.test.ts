import { formatSupportActs, getSupportActs } from '@/lib/lineup';

describe('getSupportActs', () => {
  it('returns nothing when there is no lineup or only a headliner', () => {
    expect(getSupportActs({ name: 'Odd Mob' })).toEqual([]);
    expect(getSupportActs({ name: 'Odd Mob', lineup: ['Odd Mob'] })).toEqual([]);
  });

  it('returns every act after the headliner', () => {
    // Real shape from the live NYC feed.
    expect(
      getSupportActs({
        name: 'STEVE AOKI - DIM MAK 30 TOUR',
        lineup: ['Steve Aoki', 'Nostalgix', 'Henry Fong'],
      }),
    ).toEqual(['Nostalgix', 'Henry Fong']);
  });

  it('drops acts the title already names', () => {
    // "Igorrr w/ Secret Chiefs 3" — printing the support would render the same
    // name twice on one card, which is the reason this filter exists.
    expect(
      getSupportActs({ name: 'Igorrr w/ Secret Chiefs 3', lineup: ['Igorrr', 'Secret Chiefs 3'] }),
    ).toEqual([]);
  });

  it('matches through punctuation differences between title and lineup', () => {
    // Promoters are inconsistent: "F.Silvestris" in the attraction list is
    // "F. Silvestris" in the title. A strict compare would report it as support.
    expect(
      getSupportActs({
        name: 'F. Silvestris, Angel Grace, Wishbone',
        lineup: ['F.Silvestris', 'Angel Grace', 'Wishbone'],
      }),
    ).toEqual([]);
  });

  it('keeps acts the title omits even when it names others', () => {
    expect(
      getSupportActs({
        name: 'The Avalanches (16 and Over)',
        lineup: ['The Avalanches', 'Erick The Architect', 'Jessy Lanza'],
      }),
    ).toEqual(['Erick The Architect', 'Jessy Lanza']);
  });

  it('does not treat a punctuation-only name as matching every title', () => {
    // Normalising "???" to an empty string would make includes('') true and
    // silently swallow every real support act alongside it.
    expect(
      getSupportActs({ name: 'Some Night', lineup: ['Headliner', '???', 'Real Act'] }),
    ).toEqual(['Real Act']);
  });
});

describe('formatSupportActs', () => {
  it('returns null rather than an empty string when there is nothing to add', () => {
    // The card branches on this to skip the line entirely, so an empty string
    // would leave a gap in the layout.
    expect(formatSupportActs({ name: 'Odd Mob', lineup: ['Odd Mob'] })).toBeNull();
  });

  it('uses the scene shorthand', () => {
    expect(
      formatSupportActs({ name: 'Odd Mob', lineup: ['Odd Mob', 'San Pacho', 'Coco Prosecco'] }),
    ).toBe('w/ San Pacho, Coco Prosecco');
  });

  it('counts the remainder instead of truncating a name', () => {
    expect(
      formatSupportActs(
        { name: 'Big Night', lineup: ['Head', 'A', 'B', 'C', 'D', 'E'] },
        2,
      ),
    ).toBe('w/ A, B +3 more');
  });
});
