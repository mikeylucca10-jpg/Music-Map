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

**Dual tab-bar implementation.** `expo-router/unstable-native-tabs` (`src/components/app-tabs.tsx`) doesn't render on web, so there's a parallel web-only tab bar (`src/components/app-tabs.web.tsx`) built from `expo-router/ui`'s `Tabs`/`TabList`/`TabTrigger`. Both are bottom bars with icon+label, matching each other — the web one uses `expo-blur`'s `BlurView` for a translucent/frosted background (it used to float as a pill at the *top*; that was deliberately moved to the bottom to match native and fix a real overflow bug — see the web layout gotchas below). Both must be updated together when adding/removing a tab/route.

**Platform-split files.** Metro resolves `*.web.tsx` over `*.tsx` on web automatically. Used for: the tab bars above, `animated-icon.web.tsx`, `use-color-scheme.web.ts`, and the concerts map (`concerts-map.tsx` for native vs `concerts-map.web.tsx`/`concerts-map-leaflet.web.tsx` for web).

**SSR gotcha:** because `web.output` is `"static"`, Expo Router does a Node-based static render pass (even in dev) with no `window`/`document`. Any module that touches those at import time crashes every route. This bit both the Leaflet map (fixed by lazy `import()`-ing `concerts-map-leaflet.web.tsx` client-side only from `concerts-map.web.tsx`, gated on `typeof window !== 'undefined'`) and the Supabase client (AsyncStorage's web backend touches `window`; `src/lib/supabase.ts` wraps it in an SSR-safe storage adapter that no-ops server-side). Keep this in mind before adding any browser-only library.

**Theming.** `src/constants/theme.ts` is dark-only by design — `Colors.light` and `Colors.dark` intentionally share one palette (this is not an adaptive light/dark app; styled after TIXR/CrowdVolt: near-black surfaces, one accent color (`theme.accent`, violet) used sparingly for active/selected states and saves, a single `Radius` scale (`card`/`large`/`pill`) instead of ad hoc corner values). `useTheme()` (`src/hooks/use-theme.ts`) resolves it. `ThemedText`/`ThemedView` (`src/components/`) are the standard building blocks — prefer them over raw `Text`/`View` with manual colors; `ThemedText type="eyebrow"` is the bold/uppercase/letter-spaced style used for section headers ("Buy Tickets", "Saved Concerts"). `ScreenScaffold` (`src/components/screen-scaffold.tsx`) is the shared scrollable-screen shell used by List/Settings — reuse it rather than hand-rolling the header+ScrollView pattern.

**Visual design.** Image-forward cards: `ConcertListCard` renders concert poster art (`imageUrl`) with a bottom gradient overlay (`expo-linear-gradient`) and falls back to a plain themed card when a concert has no image. `SkeletonCard`/`SkeletonCardRow` (`src/components/skeleton-card.tsx`) are pulsing placeholders shown instead of spinners while concert images load. `expo-haptics` fires a light impact on every save/favorite tap.

**Concerts data layer**, in dependency order:
`src/types/concert.ts` (`Concert`; `ConcertSummary` — the display-only shape shared by cards/the detail sheet/ticket links, i.e. everything except map coordinates and filter-only fields; `City`, `CITIES`; `SavedConcert = ConcertSummary`) → `src/services/{ticketmaster,edmtrain}.ts` (pure fetch-and-normalize per source, both return `Concert[]`) → `src/hooks/use-edm-concerts.ts` (merges sources, sorts) → `src/hooks/use-concerts-filters.ts` (client-side category filtering: This Weekend/21+/Free are real fields, Pop-ups/Festivals/Clubs/Day Parties are best-effort keyword matches) → `src/components/{concerts-filter-bar,concerts-map,concert-list-card}.tsx` → the `explore.tsx`/`list.tsx`/`index.tsx` screens. Tapping a card or map pin opens `src/components/concert-detail-sheet.tsx` (a bottom sheet), which lists tappable ticket-source rows from `src/lib/ticket-sources.ts` — Ticketmaster gets the real link/price from the API response, Vivid Seats gets a confirmed direct search link, and SeatGeek/StubHub/Dice/CrowdVolt get a domain-scoped web-search fallback (`site:seatgeek.com ...`) with a clearly-marked mock price, since none of the four have a verifiable direct search URL (see the `TODO(real pricing)` comment there for what real integration would need).

**Multi-city support.** `CITIES` (`src/types/concert.ts`) has six RA-Guide-style major US cities — Ticketmaster can query any of them today, but **NYC is the only one actually vouched for**; the rest are there so the switcher/preference are ready. Each screen (`explore.tsx`/`list.tsx`/`index.tsx`) still owns its own local `city` state independently (unchanged), but now seeds it from the signed-in user's `profiles.default_city` via `src/hooks/use-apply-default-city.ts` — a one-time effect (latched with a ref) that applies the saved default on first load without fighting a manual city switch made afterward. Users set the preference in Settings' "Default City" chip row, which calls `updateProfile({ defaultCity })`. Concert date/time formatting (`src/lib/format-date.ts`) is still hardcoded to NYC's timezone — `City.timezone` exists but isn't wired into it yet.

**Auth + database layer**: `src/lib/supabase.ts` (client) → `src/hooks/use-auth.ts` (session state, sign up/in/out) → `src/services/{profile,saved-concerts}.ts` (Supabase CRUD, RLS-scoped to `auth.uid()`) → `src/hooks/{use-profile,use-saved-concerts}.ts` → `src/app/settings.tsx`. `signUp` distinguishes an immediate session from "confirmation email required" (`data.session` is `null` in the latter case) — the Settings screen surfaces that explicitly rather than appearing to do nothing.

**Local-first caching.** `src/hooks/use-cached-resource.ts` is a generic stale-while-revalidate hook (AsyncStorage-backed): paints instantly from the last cached value, then refetches in the background and updates cache + state. Used for concerts (keyed per city), saved concerts, and profile (both keyed per user id). Reuse this rather than hand-rolling another fetch/cache hook.

**Database schema** lives in `supabase/migrations/` (plain SQL, no ORM). There is no standing Supabase CLI session — schema changes are written here as a new timestamped migration file and applied by pasting into the Supabase SQL Editor, not by running `supabase db push` (unless the user has just handed over a fresh personal access token for that).

**Web layout gotchas found the hard way** (only surfaced by screenshotting at phone width — desktop-width testing missed both):
- React Native's default `flexShrink` is `0` (unlike web CSS's `1`). A `flexGrow: 1` child with a `maxWidth` inside a row-direction parent will *not* shrink below that maxWidth on a narrow viewport — it overflows and gets clipped on both sides when the parent centers it. `ScreenScaffold`'s container uses `width: '100%'` + `maxWidth` instead of `flexGrow: 1` + `maxWidth` for exactly this reason — don't revert it.
- Leaflet's own controls (zoom buttons, etc.) use `z-index: 1000` in its default CSS. Any floating UI drawn over the web map (`concerts-map-leaflet.web.tsx`) needs a `zIndex` comfortably above that — `explore.tsx`'s overlays use `1100` — or Leaflet paints over it despite DOM order.
- React Native Web stamps *every* plain `View` with its own `position: relative; z-index: 0` by default, which means every View is its own local stacking context. A child's `zIndex` only wins against siblings *within that same parent* — it can't "escape" to out-rank an unrelated part of the tree. This bit `ConcertsFilterBar`'s city dropdown twice: once trapped inside its parent (fixed by giving the filter bar's root container its own high `zIndex`), and once losing a tie against its own sibling ScrollView (fixed by giving that specific wrapper an explicit `zIndex: 1`). When a floating menu is misbehaving, check the *whole* ancestor chain's z-index/position, not just the menu's own style.

**A repo-wide ESLint rule** (`react-hooks/set-state-in-effect`, from `eslint-config-expo`) flags most `setState` calls inside `useEffect`, including indirect ones (e.g. calling a `useCallback`-wrapped async function that eventually sets state). Where the pattern is intentional and safe (e.g. fetch-on-mount), the established convention in this codebase is a targeted `// eslint-disable-next-line react-hooks/set-state-in-effect` with a one-line comment explaining why it's safe — see `use-cached-resource.ts` for an example — rather than restructuring around the rule.

## Known open items (deferred until closer to launch)

A security audit (2026-08-13) deferred three items on purpose — don't build these proactively:
- **Ticketmaster key exposure**: `EXPO_PUBLIC_TICKETMASTER_API_KEY` ships in the client bundle. Fix is a backend proxy (Supabase Edge Function), not a config change.
- **Bot protection on signup/signin**: needs a Supabase Dashboard toggle (not `supabase/config.toml`, which is local-dev-only), an hCaptcha/Turnstile account, and a `WebView`-based widget in the app — no native RN CAPTCHA widget exists.
- **`profiles` column-level write protection**: the UPDATE RLS policy checks row ownership but not which columns are written. Not exploitable today (no privileged field exists), but revisit immediately if one is ever added (e.g. `is_admin`).
