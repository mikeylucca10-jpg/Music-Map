import { City, Concert } from '@/types/concert';

const DISCOVERY_EVENTS_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

type TicketmasterVenue = {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterAttraction = {
  name?: string;
};

type TicketmasterImage = { url: string; width?: number; height?: number };

type TicketmasterEvent = {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { dateTime?: string } };
  images?: TicketmasterImage[];
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  ageRestrictions?: { legalAgeEnforced?: boolean };
  _embedded?: { venues?: TicketmasterVenue[]; attractions?: TicketmasterAttraction[] };
};

type TicketmasterResponse = {
  _embedded?: { events?: TicketmasterEvent[] };
};

// Ticketmaster's images array isn't sorted by size — it mixes small
// thumbnails (e.g. a 305x225 "4_3" crop) in with much larger ones (a
// 2426x1365 "_SOURCE" original can be later in the same array), so
// images[0] is often the lowest-quality option, not a preview/default. Pick
// by actual pixel area instead. contentFit="cover" is used everywhere this
// renders, so aspect ratio doesn't need to match the display container.
function pickBestImage(images: TicketmasterImage[] | undefined): string | undefined {
  if (!images?.length) return undefined;
  return images.reduce((best, image) =>
    (image.width ?? 0) * (image.height ?? 0) > (best.width ?? 0) * (best.height ?? 0) ? image : best,
  ).url;
}

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

    const priceRange = event.priceRanges?.[0];

    concerts.push({
      id: `ticketmaster-${event.id}`,
      source: 'ticketmaster',
      name: event.name,
      artist: event._embedded?.attractions?.[0]?.name,
      url: event.url,
      startDateTime,
      venueName: venue.name ?? 'Venue TBA',
      address: [venue.address?.line1, venue.city?.name, venue.state?.stateCode]
        .filter(Boolean)
        .join(', '),
      latitude,
      longitude,
      imageUrl: pickBestImage(event.images),
      isFree: priceRange?.min === 0,
      is21Plus: event.ageRestrictions?.legalAgeEnforced === true,
      priceMin: priceRange?.min,
      priceMax: priceRange?.max,
      priceCurrency: priceRange?.currency,
    });
  }

  return concerts;
}
