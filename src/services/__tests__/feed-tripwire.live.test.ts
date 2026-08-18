/**
 * Live-feed tripwire. NOT part of `npm test` — run it with `npm run check:feed`.
 *
 * This exists because the genre filter has been silently broken twice by
 * Ticketmaster re-tagging its own data, with no code change on our side. Both
 * times the code was correct, the unit tests passed, and the app was wrong.
 * Unit tests cannot catch that: they assert the rule behaves as written, and
 * the rule kept behaving as written while its inputs changed meaning underneath.
 *
 * Deliberately not a monitoring stack. One command, hitting the real feed, that
 * fails loudly when the shape of the result stops looking sane.
 *
 * It keys on the signal that actually appeared both times: a single act
 * ballooning to a large share of the listings (Harry Styles was 31 of 86).
 * Chosen over a watchlist of known-bad names because names go stale the moment
 * a residency ends, while "one act should not be a third of this app" stays
 * true. It doubles as the residency-flooding detector parked earlier.
 */
import { readFileSync } from 'node:fs';
import https from 'node:https';
import { resolve } from 'node:path';

import { classificationsToJudge, isLikelyElectronic } from '@/services/ticketmaster';
import { CITIES } from '@/types/concert';

type LiveClassification = { genre?: { name?: string }; subGenre?: { name?: string } };
type LiveEvent = {
  name: string;
  classifications?: LiveClassification[];
  _embedded?: { attractions?: { name?: string; classifications?: LiveClassification[] }[] };
};

/** One act should never be this much of the kept feed. Harry Styles hit 0.36. */
const MAX_SINGLE_ACT_SHARE = 0.25;

/** Below this many listings the share check is noise, not signal. */
const MIN_LISTINGS_TO_JUDGE = 20;

/**
 * Jest does not load .env.local — only the Expo CLI does — so read it directly.
 * Kept local to this file rather than added to jest.setup.js: the rest of the
 * suite is deliberately hermetic and should not gain access to real credentials
 * just because this one test needs them.
 */
function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const raw = readFileSync(resolve(__dirname, '../../../.env.local'), 'utf8');
    const line = raw.split(/\r?\n/).find((l) => l.startsWith(name + '='));
    if (!line) return undefined;
    return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') || undefined;
  } catch {
    return undefined;
  }
}

const NYC = CITIES[0];

/**
 * Uses node:https rather than fetch.
 *
 * jest-expo replaces global fetch with Expo's FetchResponse polyfill, which is
 * built for the React Native runtime and does not work under Jest at all —
 * .status comes back undefined and .text() throws. Going straight to the Node
 * HTTP client sidesteps the polyfill entirely and needs no dependency.
 */
function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    https
      .get(url, { headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          try {
            resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function eventsFrom(url: string, headers?: Record<string, string>): Promise<LiveEvent[] | null> {
  try {
    const body = (await getJson(url, headers)) as { _embedded?: { events?: LiveEvent[] } };
    const events = body?._embedded?.events;
    return Array.isArray(events) ? events : null;
  } catch {
    return null;
  }
}

async function fetchLiveEvents(): Promise<LiveEvent[]> {
  const supabaseUrl = envValue('EXPO_PUBLIC_SUPABASE_URL');
  const anonKey = envValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const apiKey = envValue('EXPO_PUBLIC_TICKETMASTER_API_KEY');

  // Prefer the deployed proxy: it is the real production path and needs no
  // local key. Falls back to a direct call while the function is undeployed.
  if (supabaseUrl) {
    const viaProxy = await eventsFrom(`${supabaseUrl}/functions/v1/concerts?cityId=${NYC.id}`, {
      Authorization: `Bearer ${anonKey ?? ''}`,
    });
    if (viaProxy) return viaProxy;
  }

  if (!apiKey) {
    throw new Error(
      'Nothing to fetch with: the concerts function is not reachable and EXPO_PUBLIC_TICKETMASTER_API_KEY is not in .env.local.',
    );
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    city: NYC.ticketmasterCity,
    stateCode: NYC.ticketmasterStateCode,
    countryCode: NYC.ticketmasterCountryCode,
    classificationName: 'Dance/Electronic',
    startDateTime: `${new Date().toISOString().split('.')[0]}Z`,
    sort: 'date,asc',
    size: '100',
  });
  const direct = await eventsFrom(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  if (!direct) throw new Error('Ticketmaster returned no events (bad key, rate limit, or outage).');
  return direct;
}

const actOf = (event: LiveEvent) => event._embedded?.attractions?.[0]?.name ?? event.name;

function countByAct(events: LiveEvent[]) {
  const byAct = new Map<string, number>();
  for (const event of events) byAct.set(actOf(event), (byAct.get(actOf(event)) ?? 0) + 1);
  return [...byAct.entries()].sort((a, b) => b[1] - a[1]);
}

describe('live feed tripwire', () => {
  jest.setTimeout(120_000);

  let events: LiveEvent[] = [];
  let kept: LiveEvent[] = [];
  let dropped: LiveEvent[] = [];

  beforeAll(async () => {
    events = await fetchLiveEvents();
    kept = events.filter((e) => isLikelyElectronic(classificationsToJudge(e)));
    dropped = events.filter((e) => !isLikelyElectronic(classificationsToJudge(e)));

    // Printed unconditionally. Even on a pass this is the thing worth a glance,
    // and it is how both previous breaks were noticed by eye.
    console.log(`\n  feed: ${events.length} listings -> kept ${kept.length}, dropped ${dropped.length}`);
    console.log(`  dropped acts: ${[...new Set(dropped.map(actOf))].join(', ') || '(none)'}`);
    console.log('  biggest kept acts:');
    for (const [act, n] of countByAct(kept).slice(0, 5)) {
      const pct = kept.length ? ((n / kept.length) * 100).toFixed(0) : '0';
      console.log(`    ${String(n).padStart(3)}  ${pct.padStart(3)}%  ${act}`);
    }
  });

  it('returns a usable feed at all', () => {
    // Zero listings means the proxy, the key, or the upstream is broken. Worth
    // failing on before the subtler checks run against no data.
    expect(events.length).toBeGreaterThan(0);
  });

  it('keeps something', () => {
    // The opposite failure to the one below: a rule so strict it empties the
    // app. Would catch an over-tightened blocklist.
    expect(kept.length).toBeGreaterThan(0);
  });

  it('is not dominated by a single act', () => {
    if (kept.length < MIN_LISTINGS_TO_JUDGE) return;

    const [[topAct, topCount]] = countByAct(kept);
    const share = topCount / kept.length;

    if (share > MAX_SINGLE_ACT_SHARE) {
      throw new Error(
        `"${topAct}" is ${(share * 100).toFixed(0)}% of the kept feed (${topCount}/${kept.length}), ` +
          `over the ${MAX_SINGLE_ACT_SHARE * 100}% ceiling.\n` +
          `  Either the genre filter has been undermined by an upstream re-tag (this has happened twice),\n` +
          `  or a real residency is flooding the list. Check that act's ARTIST-level classification —\n` +
          `  that is the field the filter judges on.`,
      );
    }
    expect(share).toBeLessThanOrEqual(MAX_SINGLE_ACT_SHARE);
  });
});
