-- Match follows on the source's stable artist id, falling back to the name.
--
-- Following has always matched on a normalised name, which works until two acts
-- share one. Bandsintown users report exactly that failure -- following Fold the
-- funk band and being alerted about Fold the techno DJ -- and it is the kind of
-- bug that only shows up once an app is big enough for it to be expensive.
--
-- Measured on the live feed: 119 of 119 attractions carry an id, and 0 of 472
-- distinct names currently collide. So this is insurance rather than a repair,
-- which is exactly when it is cheap to add.
--
-- The name is kept as the fallback rather than replaced, for two reasons that
-- are not going away: roughly 20% of events have no attraction attached at all
-- and can only ever match by venue or name, and a second source will use a
-- different id space entirely -- EDMTrain's ids will never equal Ticketmaster's.

alter table public.followed_artists add column if not exists artist_id text;
alter table public.seen_concerts add column if not exists artist_id text;

create index if not exists followed_artists_artist_id_idx
  on public.followed_artists (artist_id) where artist_id is not null;
create index if not exists seen_concerts_artist_id_idx
  on public.seen_concerts (artist_id) where artist_id is not null;

-- ---------------------------------------------------------------------------
-- Ingest, now id-aware
-- ---------------------------------------------------------------------------

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
  select first_polled_at is not null into v_bootstrapped
  from public.poll_state where city_id = p_city_id;
  v_bootstrapped := coalesce(v_bootstrapped, false);

  with inserted as (
    insert into public.seen_concerts (
      concert_id, city_id, name, artist_key, artist_id, venue_key, starts_at, image_url
    )
    select
      item ->> 'concert_id',
      p_city_id,
      item ->> 'name',
      nullif(item ->> 'artist_key', ''),
      nullif(item ->> 'artist_id', ''),
      item ->> 'venue_key',
      (item ->> 'starts_at')::timestamptz,
      nullif(item ->> 'image_url', '')
    from jsonb_array_elements(p_concerts) as item
    on conflict (concert_id) do nothing
    returning concert_id, artist_key, artist_id, venue_key, starts_at
  ),
  queued as (
    insert into public.pending_alerts (user_id, concert_id, reason)
    select distinct follower.user_id, n.concert_id, 'just_announced'
    from inserted n
    join lateral (
      -- Id first: an exact match on a stable identifier is the only way to be
      -- certain two records mean the same act.
      select fa.user_id from public.followed_artists fa
        where n.artist_id is not null
          and fa.artist_id is not null
          and fa.artist_id = n.artist_id
      union
      -- Name second, and only where an id comparison was not possible. Without
      -- that guard a follow stored with one id would still match a *different*
      -- act sharing its name, which is the bug this whole change exists to
      -- prevent.
      select fa.user_id from public.followed_artists fa
        where n.artist_key is not null
          and fa.artist_key = n.artist_key
          and (n.artist_id is null or fa.artist_id is null)
      union
      select fv.user_id from public.followed_venues fv
        where fv.venue_key = n.venue_key
    ) as follower on true
    left join public.notification_prefs prefs on prefs.user_id = follower.user_id
    where v_bootstrapped
      and coalesce(prefs.just_announced, true)
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
        first_polled_at = coalesce(public.poll_state.first_polled_at, now());

  return query select jsonb_array_length(p_concerts), v_new_count, v_alert_count;
end;
$$;

revoke all on function public.ingest_concerts(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The same rule for tomorrow's reminders
-- ---------------------------------------------------------------------------

-- last_chance matches follows too, so it has to agree with ingest about what
-- "the same artist" means. Two different answers to that question would be
-- worse than one imperfect one.
create or replace function public.queue_tomorrow_alerts()
returns table (doors_queued integer, last_chance_queued integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doors integer := 0;
  v_last integer := 0;
begin
  insert into public.pending_alerts (user_id, concert_id, reason)
  select distinct s.user_id, s.concert_id, 'doors_tomorrow'
  from public.saved_concerts s
  left join public.notification_prefs p on p.user_id = s.user_id
  where s.start_date_time between now() + interval '12 hours' and now() + interval '36 hours'
    and coalesce(p.doors_tomorrow, true)
    and exists (select 1 from public.seen_concerts sc where sc.concert_id = s.concert_id)
  on conflict do nothing;
  get diagnostics v_doors = row_count;

  insert into public.pending_alerts (user_id, concert_id, reason)
  select distinct follower.user_id, sc.concert_id, 'last_chance'
  from public.seen_concerts sc
  join lateral (
    select fa.user_id from public.followed_artists fa
      where sc.artist_id is not null
        and fa.artist_id is not null
        and fa.artist_id = sc.artist_id
    union
    select fa.user_id from public.followed_artists fa
      where sc.artist_key is not null
        and fa.artist_key = sc.artist_key
        and (sc.artist_id is null or fa.artist_id is null)
    union
    select fv.user_id from public.followed_venues fv
      where fv.venue_key = sc.venue_key
  ) as follower on true
  left join public.notification_prefs p on p.user_id = follower.user_id
  where sc.starts_at between now() + interval '12 hours' and now() + interval '36 hours'
    and coalesce(p.doors_tomorrow, true)
    and not exists (
      select 1 from public.saved_concerts s
       where s.user_id = follower.user_id and s.concert_id = sc.concert_id
    )
  on conflict do nothing;
  get diagnostics v_last = row_count;

  return query select v_doors, v_last;
end;
$$;

revoke all on function public.queue_tomorrow_alerts() from public, anon, authenticated;
