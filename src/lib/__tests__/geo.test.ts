import { NYC_BOROUGHS } from '@/data/nyc-boroughs';
import {
  distanceLabelFor,
  formatDistanceMiles,
  getDistanceMiles,
  isPointInMultiPolygon,
} from '@/lib/geo';

// Real landmark venues, one per borough. These are the same coordinates the
// borough polygons were originally spot-checked against — if a future change
// to the boundary data or the ray-casting breaks classification, this catches
// it before venues start showing up under the wrong borough filter.
const LANDMARKS = [
  { name: 'Madison Square Garden', latitude: 40.7505, longitude: -73.9934, borough: 'manhattan' },
  { name: 'Barclays Center', latitude: 40.6826, longitude: -73.9754, borough: 'brooklyn' },
  { name: 'Yankee Stadium', latitude: 40.8296, longitude: -73.9262, borough: 'bronx' },
  { name: 'Citi Field', latitude: 40.7571, longitude: -73.8458, borough: 'queens' },
  { name: 'St. George Theatre', latitude: 40.6437, longitude: -74.0787, borough: 'staten-island' },
];

describe('isPointInMultiPolygon (NYC borough boundaries)', () => {
  it.each(LANDMARKS)('puts $name in exactly $borough', ({ latitude, longitude, borough }) => {
    const matches = NYC_BOROUGHS.filter((candidate) =>
      isPointInMultiPolygon(latitude, longitude, candidate.boundary),
    ).map((candidate) => candidate.id);

    // Asserting the full match list (not just "contains") also proves the
    // boroughs don't overlap here — the exact failure mode the old bounding
    // boxes had near shared borders.
    expect(matches).toEqual([borough]);
  });

  it('excludes a point well outside NYC', () => {
    // Philadelphia.
    const matches = NYC_BOROUGHS.filter((candidate) =>
      isPointInMultiPolygon(39.9526, -75.1652, candidate.boundary),
    );
    expect(matches).toEqual([]);
  });

  it('excludes a point in the middle of the Atlantic off Long Island', () => {
    const matches = NYC_BOROUGHS.filter((candidate) =>
      isPointInMultiPolygon(40.4, -73.8, candidate.boundary),
    );
    expect(matches).toEqual([]);
  });
});

describe('getDistanceMiles', () => {
  it('is zero for a point to itself', () => {
    expect(getDistanceMiles(40.7505, -73.9934, 40.7505, -73.9934)).toBe(0);
  });

  it('is symmetric', () => {
    const there = getDistanceMiles(40.7505, -73.9934, 40.6826, -73.9754);
    const back = getDistanceMiles(40.6826, -73.9754, 40.7505, -73.9934);
    expect(there).toBeCloseTo(back, 10);
  });

  it('returns miles, not kilometers, for a known city-scale distance', () => {
    // MSG -> Barclays Center is roughly 4.8 miles (~7.7 km), so this range
    // fails loudly if the earth-radius constant is ever swapped to km.
    const miles = getDistanceMiles(40.7505, -73.9934, 40.6826, -73.9754);
    expect(miles).toBeGreaterThan(4);
    expect(miles).toBeLessThan(6);
  });
});

describe('formatDistanceMiles', () => {
  it('says "Nearby" under a tenth of a mile', () => {
    expect(formatDistanceMiles(0.02)).toBe('Nearby');
  });

  it('keeps one decimal under 10 miles', () => {
    expect(formatDistanceMiles(4.78)).toBe('4.8 mi away');
  });

  it('rounds to whole miles at 10 and above', () => {
    expect(formatDistanceMiles(12.4)).toBe('12 mi away');
  });
});

describe('distanceLabelFor', () => {
  const venue = { latitude: 40.6826, longitude: -73.9754 };

  it('returns undefined without a viewer location', () => {
    expect(distanceLabelFor(null, venue)).toBeUndefined();
    expect(distanceLabelFor(undefined, venue)).toBeUndefined();
  });

  it('labels the distance when a viewer location is known', () => {
    expect(distanceLabelFor({ latitude: 40.7505, longitude: -73.9934 }, venue)).toMatch(
      /^\d+(\.\d)? mi away$/,
    );
  });
});
