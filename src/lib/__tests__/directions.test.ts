import { getDirectionsUrl } from '@/lib/directions';

const BARCLAYS = {
  venueName: 'Barclays Center',
  address: '620 Atlantic Ave, Brooklyn, NY',
};

// Asserted platform-agnostically: the branch picked depends on Platform.OS,
// but the properties that actually matter to the user hold on both.
describe('getDirectionsUrl', () => {
  it('points at a real maps provider', () => {
    expect(getDirectionsUrl(BARCLAYS)).toMatch(
      /^https:\/\/(maps\.apple\.com|www\.google\.com\/maps)/,
    );
  });

  it('queries by venue name and address so the destination shows a real place', () => {
    // Google's own docs warn that a bare lat/lng gives "a pin in the map, but
    // no additional place information" — which reads as wrong to users even
    // when the pin is correct. This is the regression that guards against.
    const url = getDirectionsUrl(BARCLAYS);
    expect(url).toContain(encodeURIComponent('Barclays Center, 620 Atlantic Ave, Brooklyn, NY'));
  });

  it('falls back to just the venue name when there is no address', () => {
    const url = getDirectionsUrl({ venueName: 'Brooklyn Mirage', address: '' });
    expect(url).toContain(encodeURIComponent('Brooklyn Mirage'));
    expect(url).not.toContain(encodeURIComponent('Brooklyn Mirage, '));
  });

  it('escapes characters that would otherwise break the query string', () => {
    const url = getDirectionsUrl({ venueName: 'Sound & Vision', address: '1 A/B St' });
    expect(url).not.toContain('Sound & Vision');
    expect(url).toContain(encodeURIComponent('Sound & Vision, 1 A/B St'));
  });
});
