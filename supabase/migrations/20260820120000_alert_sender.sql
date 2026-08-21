-- Poster art, so a notification can carry the image people actually recognise.
--
-- Rich notifications carrying a thumbnail measure up to 56% higher open rates
-- than plain text, and this app already has art for nearly every show. Added
-- here rather than in the original alert_engine migration because that one is
-- already applied.
--
-- Android renders the image with no further work. iOS needs a Notification
-- Service Extension target, which does not exist yet -- the field is simply
-- ignored there until it does, so this costs nothing on iOS and lights up
-- without a second change if that target is ever added.
alter table public.seen_concerts add column if not exists image_url text;

-- Who is due a notification right now, and what it should say.
--
-- Every rule that protects the user lives in this one function rather than in
-- the sender that calls it. That is deliberate: the frequency cap, the quiet
-- hours and the per-trigger opt-outs are the difference between an app people
-- keep and one they uninstall, and a rule enforced in application code is a
-- rule that gets skipped the first time someone writes a second caller.

-- ---------------------------------------------------------------------------
-- Quiet hours
-- ---------------------------------------------------------------------------

-- No sends between 10pm and 8am in the recipient's own city. Silent hours cut
-- complaint rates by 30-40%, and a 3am push about a show announcement is the
-- single fastest way to get notifications turned off for good.
--
-- The city comes from profiles.default_city, which is the only location signal
-- we have that never leaves the device boundary -- actual GPS coordinates are
-- deliberately never sent to the server (see the privacy policy, which says so
-- and has to stay true). Someone with no default city is treated as New York,
-- since that is the only city this app currently vouches for.
create or replace function public.is_quiet_hours(p_city_id text)
returns boolean
language sql
stable
as $$
  select extract(hour from (now() at time zone
    case coalesce(p_city_id, 'nyc')
      when 'la' then 'America/Los_Angeles'
      when 'sf' then 'America/Los_Angeles'
      when 'vegas' then 'America/Los_Angeles'
      when 'chicago' then 'America/Chicago'
      else 'America/New_York'
    end
  )) not between 8 and 21;
$$;

-- ---------------------------------------------------------------------------
-- The selection
-- ---------------------------------------------------------------------------

-- Returns one row per user who should be notified, with their unsent alerts
-- rolled up. The sender turns each row into exactly one push.
--
-- Rolling up here rather than in the sender is what makes batching real: three
-- announcements become one notification carrying three facts, not three
-- notifications carrying one each. Firing per-event would put an active
-- follower straight into the 6+/week band where a third of users uninstall.
create or replace function public.alerts_due()
returns table (
  user_id uuid,
  concert_ids text[],
  concert_names text[],
  alert_count integer,
  image_url text,
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
      s.name as concert_name,
      s.image_url,
      s.starts_at
    from public.pending_alerts a
    join public.seen_concerts s on s.concert_id = a.concert_id
    left join public.notification_prefs p on p.user_id = a.user_id
    left join public.profiles pr on pr.id = a.user_id
    where a.sent_at is null
      -- Never announce a show that has already happened. The feed can surface
      -- a listing late, and a queue that sat overnight can age past the door
      -- time; either way "just announced" about last night is worse than
      -- silence.
      and s.starts_at > now()
      -- Absent prefs row means defaults, and the default for something a person
      -- explicitly followed is yes. Only an explicit false opts out.
      and case a.reason
            when 'just_announced' then coalesce(p.just_announced, true)
            when 'doors_tomorrow' then coalesce(p.doors_tomorrow, true)
            else false
          end
      -- At most one notification per user per week. This is the whole reason
      -- last_notified_at exists: a cap the sender must consult, rather than a
      -- number written in a comment and honoured by whoever remembers.
      and (p.last_notified_at is null or p.last_notified_at < now() - interval '7 days')
      -- Three ignored in a row is the documented point to back off; pausing
      -- there cuts churn risk by around 15%.
      and coalesce(p.consecutive_ignored, 0) < 3
      and not public.is_quiet_hours(pr.default_city)
  )
  select
    e.user_id,
    array_agg(e.concert_id order by e.starts_at),
    array_agg(e.concert_name order by e.starts_at),
    count(*)::integer,
    -- The soonest show's art. Names, ids and image all order by starts_at
    -- so the message, the artwork and the deep link all point at one show --
    -- ordering any of them differently would caption the wrong picture.
    (array_agg(e.image_url order by e.starts_at) filter (where e.image_url is not null))[1],
    -- Every live device for that account. One account on a phone and a tablet
    -- is two tokens, and notifying only one of them is a bug people report as
    -- "it works sometimes".
    array_agg(distinct t.token)
  from eligible e
  join public.push_tokens t
    on t.user_id = e.user_id and t.disabled_at is null
  group by e.user_id;
$$;

revoke all on function public.alerts_due() from public, anon, authenticated;
revoke all on function public.is_quiet_hours(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recording what was sent
-- ---------------------------------------------------------------------------

-- Marks a user's alerts delivered and starts their week-long cooldown.
--
-- Called only after Expo accepts the push, never before. The opposite order
-- would be safer against double-sends and much worse in practice: a failure
-- mid-flight would mark alerts delivered that nobody ever received, and
-- nothing downstream could discover the gap because the queue would look
-- clean. A duplicate notification is embarrassing; a silently swallowed one
-- defeats the entire feature.
create or replace function public.mark_alerts_sent(p_user_id uuid, p_concert_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pending_alerts
     set sent_at = now()
   where user_id = p_user_id
     and concert_id = any(p_concert_ids)
     and sent_at is null;

  insert into public.notification_prefs (user_id, last_notified_at)
  values (p_user_id, now())
  on conflict (user_id) do update set last_notified_at = now();
end;
$$;

revoke all on function public.mark_alerts_sent(uuid, text[]) from public, anon, authenticated;

-- Retires a token Expo has told us is dead.
--
-- DeviceNotRegistered means the app was uninstalled or permission revoked, and
-- Expo's guidance is explicit that a server must then stop sending to it.
-- Disabled rather than deleted, so a reinstall registering the same token can
-- be told apart from one that was never seen.
create or replace function public.disable_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_tokens set disabled_at = now()
   where token = p_token and disabled_at is null;
$$;

revoke all on function public.disable_push_token(text) from public, anon, authenticated;
