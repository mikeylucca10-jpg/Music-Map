-- Stop the 7-day cap from killing "your show is tomorrow" reminders.
--
-- Confirmed in production on 2026-10-20, from inside the database rather than
-- from reasoning about the code. 24 alerts have ever been sent: 20
-- just_announced, 4 last_chance. 18 sit queued and unsent — and every one of
-- them is for a show that has already happened. 15 of the 18 are last_chance.
-- The newest was queued 2026-10-16, three days after the user's
-- last_notified_at of 2026-10-13. The engine runs hourly with zero errors and
-- has been letting its most time-sensitive alerts expire.
--
-- Why. alerts_due() applied
--     p.last_notified_at < now() - interval '7 days'
-- to EVERY reason. But queue_tomorrow_alerts() only queues doors_tomorrow and
-- last_chance for shows 12–36 hours out, and alerts_due() requires
-- s.starts_at > now(). So a reminder has at most ~36 hours to fire. The moment
-- any just_announced goes out, the user is capped for a week, and every
-- reminder queued inside that week is born with a 36-hour life it cannot use.
-- It is not deferred; it is dropped. The Alerts screen offers a "Doors
-- tomorrow" switch that was, for most of any given week, silently a no-op.
--
-- The cap was built to stop announcement spam, and it still does that. It now
-- gates just_announced only. The two reminder reasons are time-boxed by
-- construction — one row per show per user, for shows that user saved or
-- follows, inside a 36-hour window — so they cannot spam and never needed it.
-- Quiet hours and the consecutive_ignored brake still apply to all three.
--
-- mark_alerts_sent() is left alone: a reminder going out still bumps
-- last_notified_at, which then caps announcements for a week. That is the
-- conservative direction — fewer pushes, not more — and reminders no longer
-- read the cap, so bumping it cannot hurt them.
--
-- The 18 dead rows are left in place. alerts_due() already excludes them via
-- starts_at > now(), so they are inert; purging history is a separate
-- decision from fixing the rule that created it.
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
            -- The weekly cap lives here now, on announcements only. See the
            -- header: applied to every reason it dropped most reminders.
            when 'just_announced' then
              coalesce(p.just_announced, true)
              and (p.last_notified_at is null or p.last_notified_at < now() - interval '7 days')
            -- last_chance rides the same preference as doors_tomorrow: both
            -- answer "something is on tomorrow", and separating them would add
            -- a switch without adding a decision.
            when 'doors_tomorrow' then coalesce(p.doors_tomorrow, true)
            when 'last_chance' then coalesce(p.doors_tomorrow, true)
            else false
          end
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

-- Keep the grants exactly as the sender migration set them.
revoke all on function public.alerts_due() from public, anon, authenticated;
grant execute on function public.alerts_due() to service_role;
