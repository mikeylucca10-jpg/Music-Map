import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Module scope, not a hook body: the handler has to exist before a notification
 * can arrive.
 *
 * SDK 57's default with no handler is *not to show* a foreground notification —
 * so an alert landing while the app was open was dropped with no banner and no
 * sound, while the server had already stamped sent_at and burned the 7-day cap.
 *
 * shouldShowBanner/shouldShowList replace the deprecated shouldShowAlert. No
 * badge: these announce a show, they are not a queue to clear, and a count that
 * never goes down is a reason people turn notifications off.
 */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

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
 * Opens the show a tapped notification is about.
 *
 * `send-alerts` has always attached `data.concertIds` for exactly this, and
 * nothing read it — every tap opened wherever the app was last.
 *
 * useLastNotificationResponse rather than addNotificationResponseReceivedListener
 * because it also covers a cold start, where the event fires before any listener
 * could attach — and being launched *by* the notification is the common case.
 *
 * Routes only to a concert route, and only from a string id in our own payload:
 * a notification is untrusted input and must not steer navigation freely.
 */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const concertId = concertIdFrom(response ?? null);
    if (!concertId) return;
    router.push({ pathname: '/concert/[id]', params: { id: concertId } });
  }, [response]);
}
