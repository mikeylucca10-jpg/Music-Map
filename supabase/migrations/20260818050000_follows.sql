-- Follows: the primitive the alert engine is built on.
--
-- Saving a show is a bookmark — nothing happens as a result of it. A follow is
-- a standing instruction: tell me when this act or this room has something on.
-- That is the difference between an app someone browses once and one that has
-- a reason to reach them again, so this table is the foundation of phase 3.
--
-- Artists and venues are separate tables rather than one polymorphic table with
-- a `kind` column. They are followed for different reasons and will be notified
-- on different rules, and a venue has no artist id to key on. Two narrow tables
-- keep the eventual matching query simple.

-- Ticketmaster gives no stable artist id on every event, and EDMTrain will give
-- a different one again, so the name is the key. It is normalised to lower case
-- in `artist_key` for matching while `artist_name` keeps the display casing.
create table if not exists public.followed_artists (
  user_id uuid not null references auth.users (id) on delete cascade,
  artist_key text not null,
  artist_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_key)
);

create table if not exists public.followed_venues (
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_key text not null,
  venue_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_key)
);

alter table public.followed_artists enable row level security;
alter table public.followed_venues enable row level security;

-- Same policy shape as saved_concerts: a row belongs to exactly one user and is
-- only ever readable or writable by them. The `with check` on insert/update
-- matters as much as the `using` on select — without it a client could write a
-- row owned by someone else.
drop policy if exists "own followed artists" on public.followed_artists;
create policy "own followed artists" on public.followed_artists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own followed venues" on public.followed_venues;
create policy "own followed venues" on public.followed_venues
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The alert job will ask "who follows this artist?" for every new show, which
-- is the opposite direction from the app's "what does this user follow?".
-- Without these it degrades to a full scan per show once there are real users.
create index if not exists followed_artists_by_key on public.followed_artists (artist_key);
create index if not exists followed_venues_by_key on public.followed_venues (venue_key);
