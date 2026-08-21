/**
 * No splash overlay on web, deliberately.
 *
 * The browser already shows its own loading state — the tab spinner and the
 * page's background — so an app-drawn splash on top of that is a second loading
 * screen covering the first. Native needs one because the OS shows a blank
 * window until the JS bundle is ready; the web has no such gap to cover.
 *
 * Metro resolves this file over animated-icon.tsx on web automatically, so the
 * native version's wordmark and its expo-splash-screen calls never load in a
 * browser — which matters, since expo-splash-screen has nothing to hide there.
 */
export function AnimatedSplashOverlay() {
  return null;
}
