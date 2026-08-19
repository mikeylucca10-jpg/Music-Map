// Supabase Edge Function: the alert engine's poller.
//
// Fetches each city's listings and hands them to ingest_concerts(), which
// decides what is new and queues alerts for whoever follows it. This is the
// half of notifications that needs no device: it can be invoked by hand and
// checked by reading two tables.
//
// Deploy:
//   supabase functions deploy poll-concerts --no-verify-jwt
//   supabase secrets set TICKETMASTER_API_KEY=...   (already set for `concerts`)
//
// --no-verify-jwt because pg_cron calls this from inside Postgres with the
// service role key in a header rather than a user JWT. The function does its
// own authorisation below instead — it is not open.
//
// Schedule (run once in the SQL editor, after deploying):
//   select cron.schedule(
//     'poll-concerts', '0 */3 * * *',
//     $$ select net.http_post(
//          url := 'https://<project>.supabase.co/functions/v1/poll-concerts',
//          headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_key'))
//        ) $$
//   );
//
// Every three hours is deliberate. Announcements are not time-critical the way
// an on-sale is -- nobody misses a show because they heard about it two hours
// later -- and pg_cron never retries a skipped run, so a cadence that tolerates
// a missed tick is worth more here than freshness.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const DISCOVERY_EVENTS_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

/**
 * Mirrors ALLOWED_CITIES in ../concerts/index.ts and CITIES in
 * src/types/concert.ts. Keep all three in sync when a city is added.
 */
const CITIES: Record<string, { city: string; stateCode: string; countryCode: string }> = {
  nyc: { city: 'New York', stateCode: 'NY', countryCode: 'US' },
  la: { city: 'Los Angeles', stateCode: 'CA', countryCode: 'US' },
  miami: { city: 'Miami', stateCode: 'FL', countryCode: 'US' },
  chicago: { city: 'Chicago', stateCode: 'IL', countryCode: 'US' },
  sf: { city: 'San Francisco', stateCode: 'CA', countryCode: 'US' },
  vegas: { city: 'Las Vegas', stateCode: 'NV', countryCode: 'US' },
};

/**
 * ⚠️ Duplicated from src/services/ticketmaster.ts. Keep the two in step.
 *
 * This cannot be imported: that file is React Native TypeScript compiled by
 * Metro, and this is Deno. There is no build step joining them.
 *
 * The duplication is load-bearing rather than incidental, which is why it is
 * worth the hazard. Without this filter the poller records every listing the
 * loose `Dance/Electronic` query returns, including the ~39% that is not
 * electronic at all, and then alerts people about shows the app itself refuses
 * to display. A Harry Styles residency would page every follower of every venue
 * he plays.
 *
 * This rule has already been broken twice by Ticketmaster re-tagging its own
 * data with no change on our side, so treat a change in one copy as a required
 * change in the other. `npm run check:feed` is the tripwire for the app copy.
 */
const NON_ELECTRONIC_GENRE = /^(pop|r&b|hip-hop\/rap|rock|jazz|country|latin|metal|classical)$/i;
const ELECTRONIC_SUBGENRE = /electro|dance|club|house|techno|trance|amapiano|dubstep|drum|garage|disco/i;

type Classification = { genre?: { name?: string }; subGenre?: { name?: string } };

function flatten(classifications: Classification[] | undefined) {
  return classifications?.map((c) => ({
    genre: c.genre?.name,
    subGenre: c.subGenre?.name,
  }));
}

function isLikelyElectronic(
  classifications: { genre?: string; subGenre?: string }[] | undefined,
): boolean {
  if (!classifications?.length) return true;
  return classifications.some(({ genre, subGenre }) => {
    if (!NON_ELECTRONIC_GENRE.test(genre ?? '')) return true;
    return ELECTRONIC_SUBGENRE.test(subGenre ?? '');
  });
}

// The artist's classification beats the event's — event tags are edited per
// listing and drift, while an artist has one genre. See the long note at the
// same decision in src/services/ticketmaster.ts.
// deno-lint-ignore no-explicit-any
function classificationsToJudge(event: any) {
  const artist = flatten(event._embedded?.attractions?.[0]?.classifications);
  return artist?.length ? artist : flatten(event.classifications);
}

/** Mirrors followKey() in src/services/follows.ts — must normalise identically
 *  or the join in ingest_concerts silently matches nothing. */
function followKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const apiKey = Deno.env.get('TICKETMASTER_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!apiKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Server is missing configuration.' }, 500);
  }

  // Deployed with --no-verify-jwt, so this check is the only thing standing
  // between the internet and a job that burns Ticketmaster quota on every call.
  // Compared against the service role key because the only legitimate caller is
  // the cron job, which runs with it.
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${serviceKey}`) {
    return json({ error: 'Not authorised.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const results: Record<string, unknown> = {};

  for (const [cityId, city] of Object.entries(CITIES)) {
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

    let events: unknown[] = [];
    try {
      const upstream = await fetch(`${DISCOVERY_EVENTS_URL}?${params.toString()}`);
      if (!upstream.ok) {
        results[cityId] = { error: `upstream ${upstream.status}` };
        continue;
      }
      const payload = await upstream.json();
      events = payload?._embedded?.events ?? [];
    } catch {
      results[cityId] = { error: 'unreachable' };
      continue;
    }

    // A city that legitimately has nothing on is skipped rather than ingested.
    // Sending an empty array would stamp poll_state.first_polled_at and mark the
    // city bootstrapped off a failed or empty fetch — after which the next real
    // poll would treat the entire genuine catalogue as new announcements and
    // alert on all of it. Bootstrapping must only ever happen on real data.
    if (events.length === 0) {
      results[cityId] = { seen: 0, skipped: 'empty feed' };
      continue;
    }

    const rows = [];
    for (const event of events as Record<string, any>[]) {
      const venue = event._embedded?.venues?.[0];
      const startDateTime = event.dates?.start?.dateTime;
      // Same guards the app applies: no venue, no coordinates, or no start time
      // means the row is unusable, and a show we would never display must not
      // become a show we notify about.
      if (!venue?.name || !startDateTime) continue;
      if (!isLikelyElectronic(classificationsToJudge(event))) continue;

      rows.push({
        concert_id: `ticketmaster-${event.id}`,
        name: event.name,
        artist_key: event._embedded?.attractions?.[0]?.name
          ? followKey(event._embedded.attractions[0].name)
          : null,
        venue_key: followKey(venue.name),
        starts_at: startDateTime,
      });
    }

    if (rows.length === 0) {
      results[cityId] = { seen: events.length, kept: 0, skipped: 'nothing kept' };
      continue;
    }

    const { data, error } = await supabase.rpc('ingest_concerts', {
      p_city_id: cityId,
      p_concerts: rows,
    });

    results[cityId] = error
      ? { error: error.message }
      : { fetched: events.length, kept: rows.length, ...(data?.[0] ?? {}) };
  }

  return json({ ranAt: new Date().toISOString(), results });
});
