// GeoJSON MultiPolygon coordinates: an array of polygons, each an array of
// rings ([lng, lat] pairs), where the first ring is the outer boundary and
// any further rings are holes cut out of it.
export type MultiPolygonCoordinates = number[][][][];

function isPointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lngI, latI] = ring[i];
    const [lngJ, latJ] = ring[j];
    const crossesRay = latI > lat !== latJ > lat;
    if (crossesRay && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) {
      inside = !inside;
    }
  }
  return inside;
}

// Standard ray-casting point-in-polygon test against a real GeoJSON
// MultiPolygon, used to check which NYC borough a venue's coordinates
// actually fall inside (as opposed to approximating with a lat/lng bounding
// box, which produces false positives/negatives near shared borders).
export function isPointInMultiPolygon(
  lat: number,
  lng: number,
  multiPolygon: MultiPolygonCoordinates,
): boolean {
  return multiPolygon.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    if (!isPointInRing(lat, lng, outerRing)) return false;
    return !holes.some((hole) => isPointInRing(lat, lng, hole));
  });
}

const EARTH_RADIUS_MILES = 3958.8;

// Haversine great-circle distance in miles — accurate enough at city scale
// (the only scale this app cares about), no need for a full geodesy library.
export function getDistanceMiles(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

export function formatDistanceMiles(miles: number): string {
  if (miles < 0.1) return 'Nearby';
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
}

// Combines the two steps above for the common case of "label a concert with
// its distance from the viewer" — undefined when location isn't available,
// so callers can pass it straight through as an optional prop.
export function distanceLabelFor(
  from: { latitude: number; longitude: number } | null | undefined,
  to: { latitude: number; longitude: number },
): string | undefined {
  if (!from) return undefined;
  return formatDistanceMiles(getDistanceMiles(from.latitude, from.longitude, to.latitude, to.longitude));
}
