import type { Borough } from '@/types/concert';

import boroughBoundaries from './nyc-borough-boundaries.json';

// Real government-sourced borough polygons — NYC Open Data's "Borough
// Boundaries" dataset (Dept. of City Planning, dataset id gthc-hcne),
// water-excluded land boundaries, geometry simplified (tolerance 0.0003,
// ~174KB) for bundle size. Fetched via:
// https://data.cityofnewyork.us/resource/gthc-hcne.geojson?$select=boroname,borocode,simplify_preserve_topology(the_geom,0.0003)%20as%20the_geom
// Each borough is a real MultiPolygon (boroughs have disjoint parts/islands
// — e.g. Staten Island has 4, Manhattan 36), not an approximated bounding
// box, so borough assignment for a venue's lat/lng is now geometrically
// accurate rather than best-effort.
const BOROUGH_ID_BY_NAME: Record<string, string> = {
  Manhattan: 'manhattan',
  Brooklyn: 'brooklyn',
  Queens: 'queens',
  Bronx: 'bronx',
  'Staten Island': 'staten-island',
};

const BOROUGH_LABEL_BY_NAME: Record<string, string> = {
  Bronx: 'The Bronx',
};

type BoroughBoundaryFeature = {
  properties: { boroname: string; borocode: string };
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
};

const typedBoundaries = boroughBoundaries as {
  features: BoroughBoundaryFeature[];
};

export const NYC_BOROUGHS: Borough[] = typedBoundaries.features.map((feature) => {
  const name = feature.properties.boroname;
  return {
    id: BOROUGH_ID_BY_NAME[name] ?? name.toLowerCase().replace(/\s+/g, '-'),
    label: BOROUGH_LABEL_BY_NAME[name] ?? name,
    boundary: feature.geometry.coordinates,
  };
});
