export type ConcertSource = 'ticketmaster' | 'edmtrain';

export type Concert = {
  id: string;
  source: ConcertSource;
  name: string;
  url: string;
  startDateTime: string;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  isFree?: boolean;
  is21Plus?: boolean;
};

export type SavedConcert = Pick<
  Concert,
  'id' | 'name' | 'url' | 'startDateTime' | 'venueName' | 'address'
>;

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
