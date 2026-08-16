-- Per-user daily request counter for the Ask feature.
--
-- The Ask Edge Function calls a billable third-party API, so it needs a cap
-- that doesn't depend on the client behaving. A bug that fires the endpoint in
-- a loop, or one user hammering it, would otherwise spend real money.

create table if not exists public.ask_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ask_usage enable row level security;

-- Read-only to the owner (so the app can show "12 of 40 today" if wanted).
-- Nothing may write through the API: the counter is only ever advanced by the
-- security-definer function below, called from the Edge Function. A client
-- that could write here could reset its own limit.
drop policy if exists "ask usage is viewable by its owner" on public.ask_usage;
create policy "ask usage is viewable by its owner" on public.ask_usage
  for select using (auth.uid() = user_id);

-- Increment-and-return in one statement, so two concurrent requests can't both
-- read the same count and slip past the limit. Returns the new count for the
-- UTC day; the caller compares it against its own limit.
create or replace function public.increment_ask_usage(p_user_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ask_usage (user_id, usage_date, request_count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date)
  -- Unqualified table name: inside ON CONFLICT DO UPDATE the existing row is
  -- reachable only as `ask_usage`, never as `public.ask_usage`.
  do update set request_count = ask_usage.request_count + 1
  returning request_count into new_count;

  return new_count;
end;
$$;

-- Only the service role (the Edge Function) may advance the counter. Postgres
-- grants EXECUTE to PUBLIC by default, so revoke that first — but note that
-- also strips what service_role inherits through PUBLIC, hence the explicit
-- grant back. Without it the Edge Function's rpc() call fails at runtime.
revoke all on function public.increment_ask_usage(uuid) from public;
grant execute on function public.increment_ask_usage(uuid) to service_role;
