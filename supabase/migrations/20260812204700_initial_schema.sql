-- Run this once in your Supabase project's SQL Editor (or via `supabase db push`
-- if you're using the Supabase CLI). Safe to re-run: everything is IF NOT EXISTS
-- or CREATE OR REPLACE.

-- One row per signed-up user, created automatically on signup.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  default_city text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by their owner" on public.profiles;
create policy "profiles are viewable by their owner" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles are editable by their owner" on public.profiles;
create policy "profiles are editable by their owner" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- A user's saved/bookmarked concerts. Snapshots the concert's display fields
-- (name/venue/date/url) at save time since the source of truth is the
-- Ticketmaster/EDMTrain API, not our database — a saved show should still
-- display correctly even if it later drops out of the live upcoming window.
create table if not exists public.saved_concerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concert_id text not null,
  concert_name text not null,
  venue_name text not null,
  address text,
  start_date_time timestamptz not null,
  concert_url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, concert_id)
);

alter table public.saved_concerts enable row level security;

drop policy if exists "saved concerts are managed by their owner" on public.saved_concerts;
create policy "saved concerts are managed by their owner" on public.saved_concerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
