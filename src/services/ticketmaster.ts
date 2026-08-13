import { City, Concert } from '@/types/concert';

const DISCOVERY_EVENTS_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

type TicketmasterVenue = {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterEvent = {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { dateTime?: string } };
  images?: { url: string }[];
  priceRanges?: { min?: number }[];
  ageRestrictions?: { legalAgeEnforced?: boolean };
  _embedded?: { venues?: TicketmasterVenue[] };
};

type TicketmasterResponse = {
  _embedded?: { events?: TicketmasterEvent[] };
};

export async function fetchTicketmasterConcerts(city: City): Promise<Concert[]> {
  const apiKey = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_TICKETMASTER_API_KEY. Get a free key at developer.ticketmaster.com and add it to .env.local.',
    );
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    city: city.ticketmasterCity,
    stateCode: city.ticketmasterStateCode,
    countryCode: city.ticketmasterCountryCode,
    classificationName: 'Dance/Electronic',
    startDateTime: `${new Date().toISOString().split('.')[0]}Z`,
    sort: 'date,asc',
    size: '100',
  });

  const response = await fetch(`${DISCOVERY_EVENTS_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Ticketmaster request failed (${response.status})`);
  }

  const data: TicketmasterResponse = await response.json();
  const events = data._embedded?.events ?? [];

  const concerts: Concert[] = [];
  for (const event of events) {
    const venue = event._embedded?.venues?.[0];
    const latitude = Number(venue?.location?.latitude);
    const longitude = Number(venue?.location?.longitude);
    const startDateTime = event.dates?.start?.dateTime;
    if (!venue || Number.isNaN(latitude) || Number.isNaN(longitude) || !startDateTime) continue;

    concerts.push({
      id: `ticketmaster-${event.id}`,
      source: 'ticketmaster',
      name: event.name,
      url: event.url,
      startDateTime,
      venueName: venue.name ?? 'Venue TBA',
      address: [venue.address?.line1, venue.city?.name, venue.state?.stateCode]
        .filter(Boolean)
        .join(', '),
      latitude,
      longitude,
      imageUrl: event.images?.[0]?.url,
      isFree: event.priceRanges?.[0]?.min === 0,
      is21Plus: event.ageRestrictions?.legalAgeEnforced === true,
    });
  }

  return concerts;
}
