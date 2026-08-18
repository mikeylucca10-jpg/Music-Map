import { PosterDisplayWidth, PosterImageScale } from '@/constants/theme';
import { City, Concert } from '@/types/concert';


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
  classifications?: TicketmasterClassification[];
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
 *
 * Exported solely so the unit tests can reach it — the edge cases (unsorted
 * input, nothing large enough, missing dimensions) would otherwise need a
 * mocked network to exercise.
 */
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

/**
 * The local Ticketmaster key, but only in development.
 *
 * `__DEV__` compiles to `false` in a production build, so every call site
 * folds to `undefined` there and the direct-call path becomes unreachable dead
 * code. The residual risk is narrower and noted in .env.example: if
 * EXPO_PUBLIC_TICKETMASTER_API_KEY is still present when a release build is
 * made, Expo inlines the value even though nothing reads it.
 */
function devFallbackKey(): string | undefined {
  if (!__DEV__) return undefined;
  return process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY || undefined;
}

function warnDevFallback(because: string) {
  console.warn(
    `[concerts] Falling back to a direct Ticketmaster call with the local dev key because ${because}. ` +
      'Deploy the proxy with: supabase functions deploy concerts',
  );
}

const DISCOVERY_EVENTS_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

/**
 * Direct Ticketmaster call, reachable only from the `__DEV__` fallback below.
 * Never runs in a production build, where the Edge Function is the only path.
 */
async function fetchDirectFromTicketmaster(city: City, apiKey: string): Promise<Concert[]> {
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
  if (!response.ok) throw new Error(`Ticketmaster request failed (${response.status})`);
  return normalizeEvents(await response.json());
}

/**
 * Fetches through the `concerts` Edge Function rather than calling Ticketmaster
 * directly, so the API key never enters the client bundle.
 *
 * Only the network call moved. Normalisation, image selection and the
 * electronic-genre filter all still run here, which keeps them under the unit
 * tests they already have and keeps the Edge Function a dumb pipe — the less
 * logic that lives somewhere requiring a deploy to change, the better.
 */
export async function fetchTicketmasterConcerts(city: City): Promise<Concert[]> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL. Concerts are fetched through a Supabase Edge Function — copy .env.example to .env.local and fill it in.',
    );
  }

  const endpoint = `${supabaseUrl}/functions/v1/concerts?cityId=${encodeURIComponent(city.id)}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      // The anon key is designed to be public and is required by the Functions
      // gateway; unlike the Ticketmaster key it grants nothing on its own.
      headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}` },
    });
  } catch (error) {
    // A *rejected* fetch, not a bad status. This is the shape an undeployed
    // function actually takes in a browser: Supabase's gateway 404s without the
    // CORS headers the function itself would send, so the response is blocked
    // before any status is readable and fetch rejects with a network error.
    // Checking response.ok alone never sees it.
    const key = devFallbackKey();
    if (key) {
      warnDevFallback('the request was blocked (function likely not deployed)');
      return fetchDirectFromTicketmaster(city, key);
    }
    throw error;
  }

  if (!response.ok) {
    // Development escape hatch, and only that. If the Edge Function is not
    // deployed yet, fall back to calling Ticketmaster directly with a local key
    // so the app still runs locally.
    //
    // `__DEV__` compiles to `false` in a production build, so this branch is
    // dead code there and cannot re-expose the key by being reached. The
    // residual risk is narrower and already noted in .env.example: if
    // EXPO_PUBLIC_TICKETMASTER_API_KEY is still present when a release build is
    // made, Expo inlines the value even though nothing reads it.
    const key = devFallbackKey();
    if (key) {
      warnDevFallback(`the function returned ${response.status}`);
      return fetchDirectFromTicketmaster(city, key);
    }

    // Surface the function's own message when it sent one — it distinguishes a
    // missing server-side key (a config problem, no retry) from an upstream
    // failure (retryable), which classifyFetchError then reads.
    const message = await response
      .json()
      .then((body: { error?: string }) => body?.error)
      .catch(() => null);
    throw new Error(message ?? `Ticketmaster request failed (${response.status})`);
  }

  return normalizeEvents(await response.json());
}

/**
 * Shared by both fetch paths so the Edge Function route and the dev fallback
 * cannot drift apart in how they interpret a response.
 */
function normalizeEvents(data: TicketmasterResponse): Concert[] {
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

    // The *artist's* classification is preferred over the event's, and that is
    // what actually makes this work. Event tags are edited per listing and
    // drift: this same Harry Styles residency was Pop/Pop one day and
    // Pop/Electro Pop the next, and on the second day every Pop listing in the
    // feed carried Electro Pop — which the subGenre rescue then read as
    // electronic, letting all 31 dates back in. The artist tag did not move:
    //
    //   Harry Styles   event Pop/Electro Pop   artist Pop/Pop Rock
    //   Galantis       event Pop/Electro Pop   artist Dance/Electronic
    //   Bolden.        event Pop/Electro Pop   artist Dance/Electronic/Jazz-House
    //
    // An artist has one genre; an event tag is a per-listing guess. Fall back
    // to the event's own tags only when no attraction is attached, which is
    // common for multi-act club nights.
    const artistClassifications = event._embedded?.attractions?.[0]?.classifications?.map(
      (classification) => ({
        segment: classification.segment?.name,
        genre: classification.genre?.name,
        subGenre: classification.subGenre?.name,
      }),
    );

    // Dropped here rather than downstream so nothing in the app ever sees a
    // non-electronic show — the map, saved concerts, and every screen inherit
    // this for free instead of each re-deciding.
    if (!isLikelyElectronic(artistClassifications?.length ? artistClassifications : classifications))
      continue;

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
