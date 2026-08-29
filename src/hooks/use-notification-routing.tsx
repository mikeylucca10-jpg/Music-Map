import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * How a notification behaves while the app is open.
 *
 * Registered at module scope, which is what the SDK expects — the handler has
 * to exist before a notification can arrive, and a hook body runs too late for
 * one that lands during the first render.
 *
 * Nothing set this before, and the SDK 57 default is *not to show* a
 * notification that arrives in the foreground. So an alert landing while
 * someone had the app open was dropped silently: no banner, no sound, no entry
 * in the tray. Worse, the server had already counted it — mark_alerts_sent
 * stamps sent_at and bumps the seven-day cap — so that alert was gone for good
 * rather than merely late.
 *
 * shouldShowBanner/shouldShowList rather than the older shouldShowAlert, which
 * is deprecated in SDK 57.
 *
 * Skipped on web, where this app has no push support at all (no VAPID keys, no
 * service worker) and calling in is pointless.
 */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // Sound but no badge. These are "a show you follow was announced"
      // messages, not a queue to clear, and a count that never goes down is a
      // reason people turn notifications off.
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Pulls the first concert id out of a notification's data payload, if any. */
function concertIdFrom(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification?.request?.content?.data as
    | { concertIds?: unknown }
    | undefined;
  const ids = data?.concertIds;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const first = ids[0];
  return typeof first === 'string' && first.length > 0 ? first : null;
}

/**
 * Opens the show a notification is about when its notification is tapped.
 *
 * `send-alerts` has always attached `data: { concertIds }`, with a comment
 * saying it exists "so the tap can land on the show itself rather than dumping
 * someone on the home screen" — and nothing read it. Every tap opened the app
 * wherever it was last, and the payload was dead weight on every message.
 *
 * useLastNotificationResponse rather than addNotificationResponseReceivedListener
 * because it also covers the cold start: when a notification is what launched
 * the app, the event has already fired before any listener could be attached,
 * and that is the most common way an alert gets opened.
 *
 * Only ever routes to a concert route, and only for a string id from our own
 * payload — a notification is untrusted input, and it must not be able to steer
 * navigation anywhere it likes.
 */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const concertId = concertIdFrom(response ?? null);
    if (!concertId) return;
    router.push({ pathname: '/concert/[id]', params: { id: concertId } });
    // Keyed on the response identifier so re-renders cannot re-navigate, while
    // a genuinely new tap still does.
  }, [response]);
}
