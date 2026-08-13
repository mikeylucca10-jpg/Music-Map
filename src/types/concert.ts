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

export type City = {
  id: string;
  label: string;
  ticketmasterCity: string;
  ticketmasterStateCode: string;
  ticketmasterCountryCode: string;
  mapCenter: { latitude: number; longitude: number };
};

export const CITIES: City[] = [
  {
    id: 'nyc',
    label: 'New York',
    ticketmasterCity: 'New York',
    ticketmasterStateCode: 'NY',
    ticketmasterCountryCode: 'US',
    mapCenter: { latitude: 40.73, longitude: -73.99 },
  },
];
