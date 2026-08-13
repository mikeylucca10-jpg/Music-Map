# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run web` / `npm run ios` / `npm run android` — start the Expo dev server for a given platform (`npm start` lets you pick a platform interactively).
- `npm run lint` — ESLint via `expo lint` (flat config in `eslint.config.js`, extends `eslint-config-expo`).
- `npx tsc --noEmit` — type-check (no dedicated npm script for this).
- `npm run reset-project` — Expo's stock script to archive the starter app into `app-example/` and scaffold a blank `src/app/`. Not relevant day-to-day; only run if explicitly asked to reset the template.
- No test runner is configured (no Jest config, no test files).

## Environment variables

Copy `.env.example` to `.env.local` (gitignored) and fill in real values. All are `EXPO_PUBLIC_`-prefixed so Expo inlines them client-side at build time:
- `EXPO_PUBLIC_TICKETMASTER_API_KEY` — required for the concerts feature to return real data.
- `EXPO_PUBLIC_EDMTRAIN_API_KEY` — optional; `src/services/edmtrain.ts` returns `[]` until this is set.
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — required for auth/saved-concerts/profile to work; `src/lib/supabase.ts` falls back to placeholder values and `isSupabaseConfigured` gates the UI when unset.

## Architecture

This is an Expo Router (file-based routing, `src/app/`) universal app targeting iOS, Android, and web (`web.output: "static"` in `app.json`), building an NYC EDM concert finder on top of the default Expo starter template.

**Dual tab-bar implementation.** `expo-router/unstable-native-tabs` (`src/components/app-tabs.tsx`) doesn't render on web, so there's a parallel web-only tab bar (`src/components/app-tabs.web.tsx`) built from `expo-router/ui`'s `Tabs`/`TabList`/`TabTrigger`. Both must be updated together when adding/removing a tab/route.

**Platform-split files.** Metro resolves `*.web.tsx` over `*.tsx` on web automatically. Used for: the tab bars above, `animated-icon.web.tsx`, `use-color-scheme.web.ts`, and the concerts map (`concerts-map.tsx` for native vs `concerts-map.web.tsx`/`concerts-map-leaflet.web.tsx` for web).

**SSR gotcha:** because `web.output` is `"static"`, Expo Router does a Node-based static render pass (even in dev) with no `window`/`document`. Any module that touches those at import time crashes every route. This bit both the Leaflet map (fixed by lazy `import()`-ing `concerts-map-leaflet.web.tsx` client-side only from `concerts-map.web.tsx`, gated on `typeof window !== 'undefined'`) and the Supabase client (AsyncStorage's web backend touches `window`; `src/lib/supabase.ts` wraps it in an SSR-safe storage adapter that no-ops server-side). Keep this in mind before adding any browser-only library.

**Theming.** `src/constants/theme.ts` defines `Colors.light`/`Colors.dark` and a `Spacing` scale; `useTheme()` (`src/hooks/use-theme.ts`) resolves the active scheme. `ThemedText`/`ThemedView` (`src/components/`) are the standard building blocks — prefer them over raw `Text`/`View` with manual colors.

**Concerts data layer**, in dependency order:
`src/types/concert.ts` (`Concert`, `City`, `CITIES`, `SavedConcert`) → `src/services/{ticketmaster,edmtrain}.ts` (pure fetch-and-normalize per source, both return `Concert[]`) → `src/hooks/use-edm-concerts.ts` (merges sources, sorts) → `src/hooks/use-concerts-filters.ts` (client-side category filtering: This Weekend/21+/Free are real fields, Pop-ups/Festivals/Clubs/Day Parties are best-effort keyword matches) → `src/components/{concerts-filter-bar,concerts-map,concert-list-card}.tsx` → the `explore.tsx`/`list.tsx` screens, which both independently own city/filter state.

**Auth + database layer**: `src/lib/supabase.ts` (client) → `src/hooks/use-auth.ts` (session state, sign up/in/out) → `src/services/{profile,saved-concerts}.ts` (Supabase CRUD, RLS-scoped to `auth.uid()`) → `src/hooks/{use-profile,use-saved-concerts}.ts` → `src/app/settings.tsx`. `signUp` distinguishes an immediate session from "confirmation email required" (`data.session` is `null` in the latter case) — the Settings screen surfaces that explicitly rather than appearing to do nothing.

**Local-first caching.** `src/hooks/use-cached-resource.ts` is a generic stale-while-revalidate hook (AsyncStorage-backed): paints instantly from the last cached value, then refetches in the background and updates cache + state. Used for concerts (keyed per city), saved concerts, and profile (both keyed per user id). Reuse this rather than hand-rolling another fetch/cache hook.

**Database schema** lives in `supabase/migrations/` (plain SQL, no ORM). There is no standing Supabase CLI session — schema changes are written here as a new timestamped migration file and applied by pasting into the Supabase SQL Editor, not by running `supabase db push` (unless the user has just handed over a fresh personal access token for that).

**A repo-wide ESLint rule** (`react-hooks/set-state-in-effect`, from `eslint-config-expo`) flags most `setState` calls inside `useEffect`, including indirect ones (e.g. calling a `useCallback`-wrapped async function that eventually sets state). Where the pattern is intentional and safe (e.g. fetch-on-mount), the established convention in this codebase is a targeted `// eslint-disable-next-line react-hooks/set-state-in-effect` with a one-line comment explaining why it's safe — see `use-cached-resource.ts` for an example — rather than restructuring around the rule.

## Known open items (deferred until closer to launch)

A security audit (2026-08-13) deferred three items on purpose — don't build these proactively:
- **Ticketmaster key exposure**: `EXPO_PUBLIC_TICKETMASTER_API_KEY` ships in the client bundle. Fix is a backend proxy (Supabase Edge Function), not a config change.
- **Bot protection on signup/signin**: needs a Supabase Dashboard toggle (not `supabase/config.toml`, which is local-dev-only), an hCaptcha/Turnstile account, and a `WebView`-based widget in the app — no native RN CAPTCHA widget exists.
- **`profiles` column-level write protection**: the UPDATE RLS policy checks row ownership but not which columns are written. Not exploitable today (no privileged field exists), but revisit immediately if one is ever added (e.g. `is_admin`).
