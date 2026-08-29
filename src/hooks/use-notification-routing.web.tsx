/**
 * No-op on web.
 *
 * Metro resolves this over `use-notification-routing.tsx` for web builds — the
 * same platform-split pattern as the tab bars and the map.
 *
 * A split file rather than a `Platform.OS` guard inside the shared one, because
 * the native version calls `Notifications.useLastNotificationResponse()`, and a
 * hook cannot be called conditionally. On web that hook reaches
 * `ExpoNotifications.getLastNotificationResponse`, which does not exist there
 * and throws `UnavailabilityError` — and since this is called from the root
 * layout, that took down *every* screen, not just one. Caught by a smoke test
 * across all four tabs, having passed tsc, lint and 120 unit tests.
 *
 * Nothing is lost by stubbing it: this app has no web push at all — no VAPID
 * keys and no service worker — so there is no notification to route from.
 */
export function useNotificationRouting() {
  // Intentionally empty.
}
