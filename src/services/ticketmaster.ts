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
/**
 * Genres that are never electronic music, whatever the query returned.
 *
 * A `classificationName=Dance/Electronic` search matches loosely, so the live
 * NYC feed comes back 46% non-electronic by listing count. Almost all of it is
 * a handful of arena acts with long residencies — one Harry Styles run was 30
 * of 85 listings on its own.
 */
const NON_ELECTRONIC_GENRE = /^(pop|r&b|hip-hop\/rap|rock|jazz|country|latin|metal|classical)$/i;

/**
 * Sub-genres that mean "electronic after all", used to rescue events whose
 * top-level genre is one of the above. Galantis is tagged Pop / Electro Pop;
 * dropping it for the genre alone would be as wrong as keeping Harry Styles.
 *
 * Amapiano belongs here on purpose — it is a South African electronic genre,
 * even though Ticketmaster also applies the tag to things that plainly are not
 * it (Hernan Cattaneo, Desert Dwellers, and a jazz duo all carry it).
 */
const ELECTRONIC_SUBGENRE = /electro|dance|club|house|techno|trance|amapiano|dubstep|drum|garage|disco/i;

/**
 * Whether an event is plausibly electronic music.
 *
 * Only the clearly-wrong genres are excluded. `Other` is deliberately left
 * alone: it holds Bicep, Black Coffee, San Holo, Jason Ross, DJ Pauly D,
 * Kruder & Dorfmeister, NOTD, French 79, and Nitzer Ebb in the current feed.
 * Filtering down to genre === 'Dance/Electronic' would throw away roughly ten
 * real acts to catch seven bad ones.
 *
 * subGenre is *only* consulted as a rescue, never as evidence against an event,
 * because it is wrong far too often to trust in that direction — the same show
 * comes back tagged `Other` on one listing and `Amapiano` on another.
 *
 * Events with no classification data at all are kept. Absence of evidence is
 * not evidence that a show is Harry Styles.
 *
 * Every classification is checked, not just the first, which matters more than
 * it sounds: Ticketmaster attaches up to four per event, and the first is
 * frequently the least representative. "Harper, Chloe Southern..." leads with
 * Jazz but also carries Dance/Electronic/Ambient; DDXS leads with Rock but also
 * carries Dance/Electronic/Experimental Electro. Reading only the first would
 * drop both, and both are genuinely electronic. So the effective rule is: drop
 * an event only when *none* of its classifications is electronic.
 *
 * Measured against the live NYC feed: drops 33 of 85 listings across 4 acts —
 * Harry Styles (30 listings on its own), Bryson Tiller, Arlo, Teddy Riley —
 * each of which carries a single, unambiguous non-electronic classification.
 *
 * Known permissive edge: Sid Sriram at Blue Note is tagged R&B *and* Jazz *and*
 * Dance/Electronic/Ambient, so he survives on the strength of one tag. Erring
 * that way is deliberate — a missing show is harder to notice than an extra one.
 */
export function isLikelyElectronic(
  classifications: { genre?: string; subGenre?: string }[] | undefined,
): boolean {
  if (!classifications?.length) return true;
  return classifications.some(({ genre, subGenre }) => {
    if (!NON_ELECTRONIC_GENRE.test(genre ?? '')) return true;
    return ELECTRONIC_SUBGENRE.test(subGenre ?? '');
  });
}

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

    const classifications = event.classifications?.map((classification) => ({
      segment: classification.segment?.name,
      genre: classification.genre?.name,
      subGenre: classification.subGenre?.name,
    }));

    // Dropped here rather than downstream so nothing in the app ever sees a
    // non-electronic show — the map, saved concerts, and every screen inherit
    // this for free instead of each re-deciding.
    if (!isLikelyElectronic(classifications)) continue;

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
      // subGenre at all, are kept as-is so a later scorer decides what is worth
      // using. Read by isLikelyElectronic above; nothing else consumes it yet.
      classifications,
    });
  }

  return concerts;
}
