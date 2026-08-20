// Supabase Edge Function: Ticketmaster proxy.
//
// Exists so the Ticketmaster API key stops shipping inside the client bundle.
// Anything prefixed EXPO_PUBLIC_ is inlined into the JavaScript at build time
// and is trivially extractable from a downloaded app — the key was public the
// moment anyone installed it. This was flagged in the 2026-08-13 security audit
// and deferred; it is a launch blocker because the quota it burns is the
// account owner's.
//
// Deploy:
//   supabase functions deploy concerts
//   supabase secrets set TICKETMASTER_API_KEY=...
//
// After deploying, remove EXPO_PUBLIC_TICKETMASTER_API_KEY from .env.local and
// from any build environment — leaving it there re-publishes the key even
// though nothing reads it any more.

const DISCOVERY_EVENTS_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

/**
 * How many pages to walk before giving up on a city.
 *
 * Five, because Discovery refuses to page past the 1000th result of any query
 * — the documented rule is size * page < 1000, and at 199 per page that lands
 * on five. This is Ticketmaster's ceiling, not a budget of ours: it cannot be
 * raised by paying, and a city with more than ~1000 upcoming listings simply
 * cannot be retrieved in full by one query. Splitting the query by date range
 * is the escape hatch if that ever happens; nothing is close today, with the
 * busiest city at 400.
 */
const MAX_PAGES = 5;

/**
 * Cities this proxy will query, mirroring CITIES in src/types/concert.ts.
 *
 * Duplicated deliberately. The server cannot trust a city name sent by a
 * client: without this list the endpoint is a general-purpose Ticketmaster
 * proxy that anyone can point anywhere, spending the account's quota on
 * queries this app never makes.
 *
 * Keep in sync when a city is added to CITIES.
 */
const ALLOWED_CITIES: Record<string, { cities: string[]; stateCode: string; countryCode: string }> =
  {
    // Ticketmaster files venues under the *municipal* city name, and in New York
    // that is the borough, not "New York". Querying city=New York alone returned
    // only Manhattan: all 50 kept shows landed there and Brooklyn, Queens, the
    // Bronx and Staten Island were empty, which made the borough filter four
    // options that could never match anything. It also silently excluded the
    // rooms that matter most for this app -- Brooklyn Steel, Elsewhere, Avant
    // Gardner, House of Yes are all filed under Brooklyn.
    nyc: {
      cities: ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
      stateCode: 'NY',
      countryCode: 'US',
    },
    la: { cities: ['Los Angeles'], stateCode: 'CA', countryCode: 'US' },
    miami: { cities: ['Miami', 'Miami Beach'], stateCode: 'FL', countryCode: 'US' },
    chicago: { cities: ['Chicago'], stateCode: 'IL', countryCode: 'US' },
    sf: { cities: ['San Francisco', 'Oakland'], stateCode: 'CA', countryCode: 'US' },
    vegas: { cities: ['Las Vegas'], stateCode: 'NV', countryCode: 'US' },
  };

/**
 * How long a city's results are reused before hitting Ticketmaster again.
 *
 * Browsing requires no account, so this endpoint has to be callable
 * anonymously and cannot be gated behind a session the way the Ask function
 * was. Caching is what stands between that and the daily quota: concert
 * listings change on the order of days, so a fifteen-minute window collapses
 * effectively all repeat traffic into one upstream call per city.
 *
 * In-memory, so it is per-instance and lost on cold start. That is a real
 * limitation and not a complete defence — it is a large reduction in upstream
 * calls, not a rate limiter. If abuse ever becomes real, the next step is a
 * Postgres-backed cache plus per-IP counting, which is meaningfully more
 * machinery than the problem currently justifies.
 */
const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map<string, { at: number; body: string }>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const apiKey = Deno.env.get('TICKETMASTER_API_KEY');
  if (!apiKey) {
    // Deliberately the same shape of message the client used to produce for a
    // missing local key, so classifyFetchError still reads it as a config
    // problem and hides the retry rather than offering one that cannot work.
    return json({ error: 'Missing TICKETMASTER_API_KEY. Set it with: supabase secrets set' }, 503);
  }

  const url = new URL(req.url);
  const cityId = url.searchParams.get('cityId') ?? '';
  const city = ALLOWED_CITIES[cityId];
  if (!city) {
    return json({ error: `Unknown city "${cityId}".` }, 400);
  }

  const cached = cache.get(cityId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return new Response(cached.body, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    stateCode: city.stateCode,
    countryCode: city.countryCode,
    classificationName: 'Dance/Electronic',
    startDateTime: `${new Date().toISOString().split('.')[0]}Z`,
    sort: 'date,asc',
    // Raised from 100 alongside the multi-city query: one metro now spans
    // several municipal names, so the old page size would have started
    // truncating the very listings this change exists to include. 199 is the
    // Discovery API's per-page ceiling.
    size: '199',
  });
  // Repeated rather than comma-joined — Discovery treats multiple `city`
  // params as OR, while a comma is read as part of a single city name and
  // matches nothing.
  for (const name of city.cities) params.append('city', name);

  // Pages are walked until the city is exhausted rather than taking the first
  // 199 and stopping.
  //
  // Only Las Vegas needs this today -- it returned 199 of 400, losing 201
  // listings with no error and no sign anything was missing, because Vegas is
  // residency-heavy and has three pages where every other city has one. New
  // York fits in a single page at 134 of 134.
  //
  // It is built anyway because the failure mode is silent. A city that outgrows
  // one page just quietly starts hiding half its listings, and New York or
  // Miami will reach that point on their own eventually -- sooner if a second
  // source is ever merged per metro.
  const events: unknown[] = [];
  let firstPayload: Record<string, unknown> | null = null;
  let totalElements = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    params.set('page', String(page));

    let upstream: Response;
    try {
      upstream = await fetch(`${DISCOVERY_EVENTS_URL}?${params.toString()}`);
    } catch {
      // A later page failing is not worth discarding the pages already in
      // hand: a partial listing is a working app, an error is a blank screen.
      if (page === 0) return json({ error: 'Could not reach the listings service.' }, 502);
      break;
    }

    if (!upstream.ok) {
      // The upstream status is echoed but the key is never in the response, and
      // the message stays generic — a 401 here means our key is wrong, which is
      // not something a caller should be told in detail.
      if (page === 0) return json({ error: `Listings service returned ${upstream.status}.` }, 502);
      break;
    }

    const body = await upstream.json();
    if (page === 0) {
      firstPayload = body;
      totalElements = body?.page?.totalElements ?? 0;
    }

    const pageEvents = body?._embedded?.events ?? [];
    events.push(...pageEvents);

    const totalPages = body?.page?.totalPages ?? 1;
    // An empty page also ends the walk: Discovery returns one rather than an
    // error once a request runs past the deep-paging ceiling.
    if (page + 1 >= totalPages || pageEvents.length === 0) break;
  }

  // Rebuilt rather than returned as-is, so `page` describes what is actually
  // in this response instead of describing page 0 of the upstream result.
  const merged = {
    ...firstPayload,
    _embedded: { ...(firstPayload?._embedded ?? {}), events },
    page: {
      size: events.length,
      totalElements,
      totalPages: 1,
      number: 0,
      // Set when the deep-paging ceiling stopped the walk before the city ran
      // out. Nothing reads it yet; it exists so this can be noticed rather than
      // silently under-reporting the way the single-page version did.
      truncated: events.length < totalElements,
    },
  };

  const payload = JSON.stringify(merged);
  cache.set(cityId, { at: Date.now(), body: payload });

  return new Response(payload, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      // Lets any CDN or browser in front of this reuse the response too.
      'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
    },
  });
});
