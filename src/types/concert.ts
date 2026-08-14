import { NYC_BOROUGHS } from '@/data/nyc-boroughs';
import type { MultiPolygonCoordinates } from '@/lib/geo';

export type ConcertSource = 'ticketmaster' | 'edmtrain';

export type Concert = {
  id: string;
  source: ConcertSource;
  name: string;
  artist?: string;
  url: string;
  startDateTime: string;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  isFree?: boolean;
  is21Plus?: boolean;
  priceMin?: number;
  priceMax?: number;
  priceCurrency?: string;
};

// Shared shape for anything that just displays/links a concert (cards, the
// detail sheet, ticket-source links) without needing map coordinates or the
// filter-only fields (isFree/is21Plus/source).
export type ConcertSummary = Pick<
  Concert,
  | 'id'
  | 'name'
  | 'artist'
  | 'url'
  | 'startDateTime'
  | 'venueName'
  | 'address'
  | 'imageUrl'
  | 'priceMin'
  | 'priceMax'
  | 'priceCurrency'
>;

export type SavedConcert = ConcertSummary;

export type Borough = {
  id: string;
  label: string;
  // Real GeoJSON MultiPolygon boundary (NYC Dept. of City Planning's
  // official "Borough Boundaries" dataset, via NYC Open Data — see
  // src/data/nyc-boroughs.ts), used with isPointInMultiPolygon (src/lib/geo.ts)
  // to test a venue's actual coordinates against the actual borough shape,
  // not an approximated bounding box.
  boundary: MultiPolygonCoordinates;
};

export type City = {
  id: string;
  label: string;
  ticketmasterCity: string;
  ticketmasterStateCode: string;
  ticketmasterCountryCode: string;
  mapCenter: { latitude: number; longitude: number };
  /**
   * IANA timezone — carried per-city so it's ready for when concert date/time
   * formatting stops being hardcoded to NYC's timezone (see format-date.ts).
   * Not wired in yet: only the NYC data is actually vouched for right now.
   */
  timezone: string;
  // Sub-city areas for the filter bar's borough chips. Left undefined for
  // cities without well-known named sub-areas (e.g. Las Vegas) — the filter
  // bar hides the borough row entirely when this is unset.
  boroughs?: Borough[];
};

// RA Guide-style set of major US EDM cities. Ticketmaster can query any of
// these today (fetchTicketmasterConcerts already takes a City generically),
// but NYC is the only one that's actually been tested/verified — the others
// are here so the city switcher and default-city preference are ready for
// when we're ready to vouch for them too.
export const CITIES: City[] = [
  {
    id: 'nyc',
    label: 'New York',
    ticketmasterCity: 'New York',
    ticketmasterStateCode: 'NY',
    ticketmasterCountryCode: 'US',
    mapCenter: { latitude: 40.73, longitude: -73.99 },
    timezone: 'America/New_York',
    boroughs: NYC_BOROUGHS,
  },
  {
    id: 'la',
    label: 'Los Angeles',
    ticketmasterCity: 'Los Angeles',
    ticketmasterStateCode: 'CA',
    ticketmasterCountryCode: 'US',
    mapCenter: { latitude: 34.05, longitude: -118.24 },
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'miami',
    label: 'Miami',
    ticketmasterCity: 'Miami',
    ticketmasterStateCode: 'FL',
    ticketmasterCountryCode: 'US',
    mapCenter: { latitude: 25.76, longitude: -80.19 },
    timezone: 'America/New_York',
  },
  {
    id: 'chicago',
    label: 'Chicago',
    ticketmasterCity: 'Chicago',
    ticketmasterStateCode: 'IL',
    ticketmasterCountryCode: 'US',
    mapCenter: { latitude: 41.88, longitude: -87.63 },
    timezone: 'America/Chicago',
  },
  {
    id: 'sf',
    label: 'San Francisco',
    ticketmasterCity: 'San Francisco',
    ticketmasterStateCode: 'CA',
    ticketmasterCountryCode: 'US',
    mapCenter: { latitude: 37.77, longitude: -122.42 },
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'vegas',
    label: 'Las Vegas',
    ticketmasterCity: 'Las Vegas',
    ticketmasterStateCode: 'NV',
    ticketmasterCountryCode: 'US',
    mapCenter: { latitude: 36.17, longitude: -115.14 },
    timezone: 'America/Los_Angeles',
  },
];
