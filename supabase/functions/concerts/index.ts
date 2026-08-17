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
 * Cities this proxy will query, mirroring CITIES in src/types/concert.ts.
 *
 * Duplicated deliberately. The server cannot trust a city name sent by a
 * client: without this list the endpoint is a general-purpose Ticketmaster
 * proxy that anyone can point anywhere, spending the account's quota on
 * queries this app never makes.
 *
 * Keep in sync when a city is added to CITIES.
 */
const ALLOWED_CITIES: Record<string, { city: string; stateCode: string; countryCode: string }> = {
  nyc: { city: 'New York', stateCode: 'NY', countryCode: 'US' },
  la: { city: 'Los Angeles', stateCode: 'CA', countryCode: 'US' },
  miami: { city: 'Miami', stateCode: 'FL', countryCode: 'US' },
  chicago: { city: 'Chicago', stateCode: 'IL', countryCode: 'US' },
  sf: { city: 'San Francisco', stateCode: 'CA', countryCode: 'US' },
  vegas: { city: 'Las Vegas', stateCode: 'NV', countryCode: 'US' },
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
    city: city.city,
    stateCode: city.stateCode,
    countryCode: city.countryCode,
    classificationName: 'Dance/Electronic',
    startDateTime: `${new Date().toISOString().split('.')[0]}Z`,
    sort: 'date,asc',
    size: '100',
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${DISCOVERY_EVENTS_URL}?${params.toString()}`);
  } catch {
    return json({ error: 'Could not reach the listings service.' }, 502);
  }

  if (!upstream.ok) {
    // The upstream status is echoed but the key is never in the response, and
    // the message stays generic — a 401 here means our key is wrong, which is
    // not something a caller should be told in detail.
    return json({ error: `Listings service returned ${upstream.status}.` }, 502);
  }

  const payload = await upstream.text();
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
