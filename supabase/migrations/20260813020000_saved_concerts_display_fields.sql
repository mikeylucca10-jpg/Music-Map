-- Adds the fields the redesigned poster cards + detail sheet need to render
-- a saved concert the same way as a freshly-fetched one (artwork, artist,
-- real Ticketmaster pricing) without re-fetching from the API.
alter table public.saved_concerts add column if not exists artist text;
alter table public.saved_concerts add column if not exists image_url text;
alter table public.saved_concerts add column if not exists price_min numeric;
alter table public.saved_concerts add column if not exists price_max numeric;
alter table public.saved_concerts add column if not exists price_currency text;
