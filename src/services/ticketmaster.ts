import { PosterDisplayWidth, PosterImageScale } from '@/constants/theme';
import { City, Concert } from '@/types/concert';

const DISCOVERY_EVENTS_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

/** Source pixels to ask for. Both inputs live in constants/theme.ts. */
const POSTER_TARGET_WIDTH = PosterDisplayWidth * PosterImageScale;

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

export type TicketmasterImage = { url: string; width?: number; height?: number };

type TicketmasterClassification = {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
};

type TicketmasterEvent = {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { dateTime?: string } };
  images?: TicketmasterImage[];
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  ageRestrictions?: { legalAgeEnforced?: boolean };
  classifications?: TicketmasterClassification[];
  _embedded?: { venues?: TicketmasterVenue[]; attractions?: TicketmasterAttraction[] };
};

type TicketmasterResponse = {
  _embedded?: { events?: TicketmasterEvent[] };
};

/**
 * Smallest image that still covers the target width, falling back to the
 * largest available when nothing reaches it.
 *
 * Ticketmaster's images array is not sorted by size — a 305x225 thumbnail can
 * sit ahead of a 2426x1365 original in the same response — so images[0] is
 * often the worst option rather than a sensible default. The previous rule
 * corrected for that by always taking the *largest*, which overshot badly: a
 * 2426px source (537 KB measured) rendering into a card about 360pt wide.
 *
 * A typical ladder here is 100 / 205 / 305 / 424 / 640 / 1024 / 1136 / 2048 /
 * 2426, so at a 720px target this lands on 1024 — about 157 KB, roughly 70%
 * less, with more pixels than a 3x phone can show at this display size.
 *
 * The anti-thumbnail property is preserved: sub-target candidates are never
 * chosen while any candidate clears the target.
 *
 * contentFit="cover" is used everywhere this renders, so aspect ratio does not
 * need to match the display container — only width matters here.
 */
// Exported solely so the unit tests can reach it — the selection rule has
// fiddly edge cases (unsorted input, nothing large enough, missing dimensions)
// and testing it through fetchTicketmasterConcerts would need a mocked network.
export function pickImageForWidth(
  images: TicketmasterImage[] | undefined,
  targetWidth: number,
): string | undefined {
  if (!images?.length) return undefined;

  const largest = images.reduce((best, image) =>
    (image.width ?? 0) * (image.height ?? 0) > (best.width ?? 0) * (best.height ?? 0) ? image : best,
  );

  const smallestSufficient = images
    .filter((image) => (image.width ?? 0) >= targetWidth)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];

  return (smallestSufficient ?? largest).url;
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
      imageUrl: pickImageForWidth(event.images, POSTER_TARGET_WIDTH),
      isFree: priceRange?.min === 0,
      is21Plus: event.ageRestrictions?.legalAgeEnforced === true,
      priceMin: priceRange?.min,
      priceMax: priceRange?.max,
      priceCurrency: priceRange?.currency,
      // Flattened from Ticketmaster's nested {name} wrappers but otherwise
      // unfiltered — entries whose genre is "Other", or which carry no
      // subGenre at all, are kept as-is so the eventual scorer decides what is
      // worth using. Nothing reads this yet.
      classifications: event.classifications?.map((classification) => ({
        segment: classification.segment?.name,
        genre: classification.genre?.name,
        subGenre: classification.subGenre?.name,
      })),
    });
  }

  return concerts;
}
