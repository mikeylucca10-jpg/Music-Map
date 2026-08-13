-- Caps display_name length at the DB level — client-side maxLength is only
-- a UX nicety, not enforcement, since anyone can call the API directly.
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 50);
