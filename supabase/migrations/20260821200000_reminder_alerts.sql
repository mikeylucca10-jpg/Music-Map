-- Tomorrow's shows: the ones you're going to, and the ones you're about to miss.
--
-- Until now the only alert anything actually created was 'just_announced'. The
-- Alerts screen offered a "Doors tomorrow" switch that nothing could ever
-- honour -- a promise the UI made and the server never kept, which is worse
-- than not offering it. This closes that, and adds the alert that was missing
-- entirely.

-- 'last_chance' joins the allowed reasons. Dropped and recreated rather than
-- altered because a CHECK constraint cannot be extended in place.
alter table public.pending_alerts drop constraint if exists pending_alerts_reason_check;
alter table public.pending_alerts add constraint pending_alerts_reason_check
  check (reason in ('just_announced', 'doors_tomorrow', 'last_chance'));

-- ---------------------------------------------------------------------------
-- Queueing tomorrow's reminders
-- ---------------------------------------------------------------------------

-- Two alerts, one pass, because they are the same question asked of two groups:
-- what is happening tomorrow that this person cares about.
--
--   doors_tomorrow -- a show they saved. Our equivalent of an RSVP, and the
--     group Bandsintown reserves its day-before reminder for. They said they
--     were going; this is a courtesy, not a pitch.
--
--   last_chance -- a show by an artist or at a venue they follow, tomorrow,
--     that they have *not* saved. This is the highest-intent moment the app
--     has: the interest is already proven by the follow, the deadline is real,
--     and the absence of a save means they may simply not know.
--
-- Both are gated on the same preference. They are two halves of "something is
-- on tomorrow", and splitting them into separate switches would add a toggle
-- without adding a decision anybody actually wants to make separately.
--
-- Safe to run repeatedly: pending_alerts is keyed on
-- (user_id, concert_id, reason), so a second run in the same day collides
-- rather than duplicating. That matters because pg_cron never retries a
-- skipped job, so every job here has to be safe to run twice.
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
  -- "Tomorrow" is a window rather than a calendar day, deliberately. A calendar
  -- comparison would fire at 00:01 for a show 47 hours away and skip one 20
  -- hours away, depending only on which side of midnight the job happened to
  -- run. A rolling 12-to-36-hour window means the reminder always lands roughly
  -- a day ahead whenever the job runs.
  insert into public.pending_alerts (user_id, concert_id, reason)
  select distinct s.user_id, s.concert_id, 'doors_tomorrow'
  from public.saved_concerts s
  left join public.notification_prefs p on p.user_id = s.user_id
  where s.start_date_time between now() + interval '12 hours' and now() + interval '36 hours'
    and coalesce(p.doors_tomorrow, true)
    -- Only for shows the alert engine already knows about, since
    -- pending_alerts references seen_concerts. A saved show the poller has
    -- never seen cannot be alerted on, which is correct rather than a gap:
    -- it means the show is not in any city we poll.
    and exists (select 1 from public.seen_concerts sc where sc.concert_id = s.concert_id)
  on conflict do nothing;
  get diagnostics v_doors = row_count;

  insert into public.pending_alerts (user_id, concert_id, reason)
  select distinct follower.user_id, sc.concert_id, 'last_chance'
  from public.seen_concerts sc
  join lateral (
    select fa.user_id from public.followed_artists fa
      where sc.artist_key is not null and fa.artist_key = sc.artist_key
    union
    select fv.user_id from public.followed_venues fv
      where fv.venue_key = sc.venue_key
  ) as follower on true
  left join public.notification_prefs p on p.user_id = follower.user_id
  where sc.starts_at between now() + interval '12 hours' and now() + interval '36 hours'
    and coalesce(p.doors_tomorrow, true)
    -- Not already going. Someone who saved it gets doors_tomorrow instead, and
    -- receiving both for one show would read as the app losing track of itself.
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

-- ---------------------------------------------------------------------------
-- Telling them apart when sending
-- ---------------------------------------------------------------------------

-- alerts_due() now reports which reason a user's queued alerts carry, so the
-- sender can word the message correctly. "New show announced" is wrong for a
-- reminder about tomorrow, and a reminder that reads like an announcement is
-- how people learn to stop trusting notifications.
--
-- One reason per notification: the earliest-starting alert decides, and mixing
-- an announcement with a reminder in a single push would produce a message that
-- describes neither.
drop function if exists public.alerts_due();
create or replace function public.alerts_due()
returns table (
  user_id uuid,
  concert_ids text[],
  concert_names text[],
  alert_count integer,
  image_url text,
  reason text,
  tokens text[]
)
language sql
security definer
set search_path = public
as $$
  with eligible as (
    select
      a.user_id,
      a.concert_id,
      a.reason,
      s.name as concert_name,
      s.image_url,
      s.starts_at
    from public.pending_alerts a
    join public.seen_concerts s on s.concert_id = a.concert_id
    left join public.notification_prefs p on p.user_id = a.user_id
    left join public.profiles pr on pr.id = a.user_id
    where a.sent_at is null
      and s.starts_at > now()
      and case a.reason
            when 'just_announced' then coalesce(p.just_announced, true)
            -- last_chance rides the same preference as doors_tomorrow: both
            -- answer "something is on tomorrow", and separating them would add
            -- a switch without adding a decision.
            when 'doors_tomorrow' then coalesce(p.doors_tomorrow, true)
            when 'last_chance' then coalesce(p.doors_tomorrow, true)
            else false
          end
      and (p.last_notified_at is null or p.last_notified_at < now() - interval '7 days')
      and coalesce(p.consecutive_ignored, 0) < 3
      and not public.is_quiet_hours(pr.default_city)
  ),
  -- The reason belonging to whichever alert starts soonest. That show is the
  -- one the message names, so the wording has to match it.
  chosen as (
    select distinct on (user_id) user_id, reason
    from eligible
    order by user_id, starts_at
  )
  select
    e.user_id,
    array_agg(e.concert_id order by e.starts_at),
    array_agg(e.concert_name order by e.starts_at),
    count(*)::integer,
    (array_agg(e.image_url order by e.starts_at) filter (where e.image_url is not null))[1],
    max(c.reason),
    array_agg(distinct t.token)
  from eligible e
  join chosen c on c.user_id = e.user_id
  join public.push_tokens t
    on t.user_id = e.user_id and t.disabled_at is null
  group by e.user_id;
$$;

revoke all on function public.alerts_due() from public, anon, authenticated;
