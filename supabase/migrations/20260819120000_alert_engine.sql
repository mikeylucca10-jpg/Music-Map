-- Alert engine, server half: knowing what is new, and who should hear about it.
--
-- Following is a standing instruction ("tell me when this act has something
-- on") and until something delivers on it, the Following filter is the whole
-- feature. This is the half that can be built and tested without a phone; the
-- client half needs a development build, since push notifications stopped
-- working in Expo Go as of SDK 54 and this project is on 57.
--
-- Shaped after what Bandsintown actually does, which publishes its triggers:
-- "Just Announced" to followers within 75 miles, plus reminders that go only to
-- people who already signalled intent (RSVPs), never to all followers. The
-- narrowing is the part worth copying — they spend their frequency budget on
-- people who raised a hand. Our equivalent of an RSVP is a saved concert.
--
-- Frequency is a hard constraint, not a preference. Users receiving more than
-- six pushes a week from one app are 3.4x more likely to uninstall it within
-- thirty days, and 6-10 a week puts a third of them out the door. So the
-- design goal here is *at most one* notification per user per week, and the
-- schema is built to make that enforceable rather than aspirational.

-- ---------------------------------------------------------------------------
-- What we have already seen
-- ---------------------------------------------------------------------------

-- Ticketmaster has no "created at" field, so "new" can only mean "not in the
-- feed the last time we looked". That makes this table the entire definition of
-- newness, and its primary key the idempotency key: the database, not the
-- application, decides whether a listing has been seen before.
--
-- Rows are kept permanently rather than expired. The feed rolls, and an event
-- can drop out and come back -- a temporary delisting, a corrected record, a
-- rescheduled date. With a TTL, its return would read as a fresh announcement
-- and re-alert everyone who follows the act. Keeping the row forever makes that
-- impossible by construction. These rows are tiny and bounded by how many shows
-- actually exist, so there is no reason to reclaim them.
create table if not exists public.seen_concerts (
  -- The app's own id ("ticketmaster-Z7r9jZ1A70d-4"), already source-prefixed,
  -- so a second source cannot collide with Ticketmaster's namespace.
  concert_id text primary key,
  city_id text not null,
  name text not null,
  -- Normalised the same way followKey() does in src/services/follows.ts, so
  -- matching against followed_artists / followed_venues is an equality join and
  -- can use an index. Artist is nullable: multi-act club nights frequently have
  -- no attraction attached, and those match on venue alone.
  artist_key text,
  venue_key text not null,
  starts_at timestamptz not null,
  first_seen_at timestamptz not null default now()
);

create index if not exists seen_concerts_artist_key_idx
  on public.seen_concerts (artist_key) where artist_key is not null;
create index if not exists seen_concerts_venue_key_idx
  on public.seen_concerts (venue_key);

-- Which cities have ever completed a poll.
--
-- Without this the very first run is a disaster: every one of the ~86 listings
-- in a city is "not seen before", so every follower of every act gets alerted
-- about the entire existing catalogue at once. The first poll for a city
-- therefore records everything and raises nothing; only later polls can
-- generate alerts. Same applies the first time a new city is switched on.
create table if not exists public.poll_state (
  city_id text primary key,
  first_polled_at timestamptz,
  last_polled_at timestamptz,
  last_seen_count integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Who to reach, and how
-- ---------------------------------------------------------------------------

-- One row per device, not per user: the same account on a phone and a tablet is
-- two tokens, and dropping one would silently stop notifying that device.
create table if not exists public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text primary key,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  -- Set when Expo reports DeviceNotRegistered, which means the app was
  -- uninstalled or permission was revoked. Expo's guidance is explicit that a
  -- server must then stop sending to that token; we disable rather than delete
  -- so a reinstall can be told apart from a token that was never seen.
  disabled_at timestamptz
);

create index if not exists push_tokens_user_idx
  on public.push_tokens (user_id) where disabled_at is null;

-- Per-trigger opt-outs. Category-level control is the single cheapest defence
-- against permanent opt-out: letting people choose topics and frequency cuts
-- opt-outs by about a fifth, and "too frequent, not personal enough" is the
-- most-cited reason people disable notifications for good -- ahead of
-- irrelevance, bad timing, or permission scope.
--
-- Defaults reflect what someone following an act has actually asked for. A new
-- announcement is the thing they signed up for, so it is on. The weekly digest
-- is marketing by another name, so it is off until asked for.
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  just_announced boolean not null default true,
  doors_tomorrow boolean not null default true,
  weekly_digest boolean not null default false,
  -- Stamped on every successful send and checked before the next one. This is
  -- what makes the one-per-week cap real: it is a column the sender must
  -- consult, not a rule living in a comment.
  last_notified_at timestamptz,
  -- Three ignored notifications in a row is the documented point to back off;
  -- pausing there cuts churn risk by around 15%. Reset to zero whenever a
  -- notification is opened.
  consecutive_ignored integer not null default 0
);

-- ---------------------------------------------------------------------------
-- What is waiting to be sent
-- ---------------------------------------------------------------------------

-- Alerts are staged here rather than sent the moment a new show is found.
--
-- That indirection is the whole batching strategy. If three followed acts
-- announce on the same day, firing on discovery sends three notifications --
-- straight into the frequency band that gets apps uninstalled. Staging lets a
-- separate pass collapse them into one "3 new shows from artists you follow",
-- which is one notification carrying three facts instead of three carrying one.
--
-- It also decouples finding from sending: the poll can run often enough to
-- catch announcements promptly while sending stays on a civilised schedule and
-- inside quiet hours.
create table if not exists public.pending_alerts (
  user_id uuid not null references auth.users (id) on delete cascade,
  concert_id text not null references public.seen_concerts (concert_id) on delete cascade,
  reason text not null check (reason in ('just_announced', 'doors_tomorrow')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  -- One row per user per concert per reason. Re-running the poll, or a feed
  -- that briefly reports a show twice, cannot queue a duplicate: the insert
  -- collides instead. Skipped cron runs are never retried by pg_cron, so every
  -- job here has to be safe to run twice and safe to miss entirely.
  primary key (user_id, concert_id, reason)
);

create index if not exists pending_alerts_unsent_idx
  on public.pending_alerts (user_id) where sent_at is null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.seen_concerts enable row level security;
alter table public.poll_state enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.pending_alerts enable row level security;

-- seen_concerts and poll_state carry no user data and are written only by the
-- poller running under the service role, which bypasses RLS. No policy is
-- created for them at all, so with RLS enabled the anon and authenticated roles
-- can reach neither. That is deliberate: the client has no reason to read our
-- record of what we have already seen.

drop policy if exists "own push tokens" on public.push_tokens;
create policy "own push tokens" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notification prefs" on public.notification_prefs;
create policy "own notification prefs" on public.notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Readable so a future in-app inbox can show what was sent, but never writable
-- from a client: allowing that would let anyone queue a push to themselves, and
-- more importantly reset their own rate limit.
drop policy if exists "read own pending alerts" on public.pending_alerts;
create policy "read own pending alerts" on public.pending_alerts
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Ingest: record what the feed returned, and queue alerts for what is new
-- ---------------------------------------------------------------------------

-- The whole diff in one statement, called by the poller with the normalised
-- feed as JSON. Kept in PL/pgSQL rather than in the Edge Function because the
-- recommended shape for scheduled work is logic in the database and a trivial
-- call in the cron entry -- it keeps the schedule readable and lets this be
-- tested directly from the SQL editor with a handmade payload.
--
-- Runs as one transaction, which matters more here than it looks: the insert
-- that decides "this is new" and the insert that queues the alert must commit
-- together. Split across two round trips, a crash in between marks a show as
-- seen while nobody is ever told about it -- a silent miss that no retry can
-- discover, because the second run correctly considers the show old.
create or replace function public.ingest_concerts(p_city_id text, p_concerts jsonb)
returns table (seen_total integer, newly_seen integer, alerts_queued integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bootstrapped boolean;
  v_new_count integer := 0;
  v_alert_count integer := 0;
begin
  -- Has this city ever completed a poll? Read before inserting anything, since
  -- the insert below is what makes it true.
  select first_polled_at is not null into v_bootstrapped
  from public.poll_state where city_id = p_city_id;
  v_bootstrapped := coalesce(v_bootstrapped, false);

  -- Both inserts in one statement, via data-modifying CTEs, because they have
  -- to commit together. Split across two statements, a failure in between
  -- records a show as seen while nobody is ever told -- and no retry can find
  -- it, since the next run correctly considers that show old. A silent
  -- permanent miss is the one failure mode this design cannot tolerate.
  with inserted as (
    -- Newly returned rows are exactly the shows we had never seen. ON CONFLICT
    -- DO NOTHING means a listing already on file is skipped silently, so a show
    -- that dropped out of the feed and came back cannot masquerade as a new
    -- announcement.
    insert into public.seen_concerts (
      concert_id, city_id, name, artist_key, venue_key, starts_at
    )
    select
      item ->> 'concert_id',
      p_city_id,
      item ->> 'name',
      nullif(item ->> 'artist_key', ''),
      item ->> 'venue_key',
      (item ->> 'starts_at')::timestamptz
    from jsonb_array_elements(p_concerts) as item
    on conflict (concert_id) do nothing
    returning concert_id, artist_key, venue_key, starts_at
  ),
  queued as (
    insert into public.pending_alerts (user_id, concert_id, reason)
    select distinct follower.user_id, n.concert_id, 'just_announced'
    from inserted n
    join lateral (
      select fa.user_id from public.followed_artists fa
        where n.artist_key is not null and fa.artist_key = n.artist_key
      union
      select fv.user_id from public.followed_venues fv
        where fv.venue_key = n.venue_key
    ) as follower on true
    left join public.notification_prefs prefs on prefs.user_id = follower.user_id
    -- The first poll of a city records the catalogue and tells nobody. Every
    -- show is technically "new" to us on that run, and alerting would make a
    -- follower's first contact from this app a blast about a hundred shows
    -- that were already there.
    where v_bootstrapped
      -- No prefs row means defaults, and the default for something a person
      -- explicitly followed is yes. Only an explicit false opts out.
      and coalesce(prefs.just_announced, true)
      -- Never alert about a show that already started. The feed can surface a
      -- listing late, and "just announced" about last night is worse than
      -- saying nothing at all.
      and n.starts_at > now()
    on conflict do nothing
    returning 1
  )
  select
    (select count(*) from inserted),
    (select count(*) from queued)
  into v_new_count, v_alert_count;

  insert into public.poll_state (city_id, first_polled_at, last_polled_at, last_seen_count)
  values (p_city_id, now(), now(), jsonb_array_length(p_concerts))
  on conflict (city_id) do update
    set last_polled_at = now(),
        last_seen_count = excluded.last_seen_count,
        -- coalesce, not overwrite: the first poll's timestamp is what marks
        -- the city bootstrapped and must survive every later poll.
        first_polled_at = coalesce(public.poll_state.first_polled_at, now());

  return query select jsonb_array_length(p_concerts), v_new_count, v_alert_count;
end;
$$;

-- Callable only by the service role. Same reasoning as increment_ask_usage: a
-- security definer function that writes alert rows must not be reachable from a
-- client, or anyone could queue pushes to other users, or forge "seen" rows to
-- suppress a real announcement before it is ever noticed.
revoke all on function public.ingest_concerts(text, jsonb) from public, anon, authenticated;
