import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { readCache, writeCache } from '@/lib/cache';
import { registerPushToken } from '@/services/push-tokens';

const CHOICE_CACHE_KEY = 'notification-prompt-choice';

/**
 * 'declined' = they tapped "Not Now" in our sheet. Stay quiet; asking again on
 * the next launch is how an app gets its notifications turned off for good.
 * 'requested' = they tapped "Turn On Alerts" at some point, which is not the
 * same as still being granted — permission can be revoked in system settings
 * afterwards, and we want to know the difference.
 */
type StoredChoice = 'declined' | 'requested';

export type PushStatus = 'idle' | 'granted' | 'denied' | 'unsupported';

/**
 * Why push cannot work here, when it cannot.
 *
 * Returned rather than thrown, and surfaced as plain text, because every one of
 * these is a permanent property of the environment rather than a failure to
 * retry. Showing a soft-ask that leads to a dialog that cannot appear is worse
 * than showing nothing.
 */
function getUnsupportedReason(): string | null {
  if (Platform.OS === 'web') {
    // Web push needs VAPID keys and a service worker, neither of which this app
    // has. expo-notifications' web support is not a drop-in for that.
    return 'Push notifications are not supported on web in this app.';
  }
  // Expo Go stopped carrying push support in SDK 54; this project is on 57. In
  // Expo Go the call does not fail cleanly — it throws — so this is checked
  // first rather than caught after.
  if (Constants.appOwnership === 'expo') {
    return 'Push notifications need a development build. They no longer work in Expo Go.';
  }
  return null;
}

/**
 * Push registration, gated behind the app's own ask.
 *
 * Same shape as useUserLocation deliberately: the OS dialog is one-shot and
 * effectively permanent once dismissed, so it is only ever fired after someone
 * has said yes to our sheet first.
 *
 * Read-only until `request()` is called. Mounting this hook never triggers a
 * permission dialog, which is what lets a screen check the current state
 * without becoming the thing that asks.
 */
export function usePushNotifications(userId: string | null) {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [hasPrompted, setHasPrompted] = useState<StoredChoice | null | 'unknown'>('unknown');
  const unsupportedReason = getUnsupportedReason();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (unsupportedReason) {
        if (!cancelled) {
          setStatus('unsupported');
          setHasPrompted(null);
        }
        return;
      }
      const choice = (await readCache<StoredChoice>(CHOICE_CACHE_KEY)) ?? null;
      let granted = false;
      try {
        const permission = await Notifications.getPermissionsAsync();
        granted = permission.granted;
      } catch {
        // Treat an unreadable permission state as "not granted" rather than
        // letting it throw: a broken read must not take the screen down.
        granted = false;
      }
      if (cancelled) return;
      setHasPrompted(choice);
      setStatus(granted ? 'granted' : 'idle');
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [unsupportedReason]);

  /**
   * Fires the real OS dialog and registers the resulting token.
   *
   * Only ever called from the soft-ask's "Turn On Alerts", never on mount.
   */
  const request = useCallback(async () => {
    if (unsupportedReason) return false;
    await writeCache<StoredChoice>(CHOICE_CACHE_KEY, 'requested');
    setHasPrompted('requested');
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return false;
      }
      setStatus('granted');

      // The project id is required by the modern Expo push service and is not
      // inferable at runtime in a bare/dev build, so a missing one is a real
      // configuration error rather than something to paper over.
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.warn(
          'No EAS project id found; cannot fetch an Expo push token. Run `eas init` and rebuild.',
        );
        return false;
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      // Permission can be granted while there is nobody to attribute the token
      // to — the sheet is reachable before sign-in completes. The grant still
      // stands; registration simply happens on the next launch with a session.
      if (userId && token) {
        await registerPushToken(userId, token, Platform.OS === 'ios' ? 'ios' : 'android');
      }
      return true;
    } catch (error) {
      console.warn('Push registration failed', error);
      setStatus('denied');
      return false;
    }
  }, [unsupportedReason, userId]);

  const decline = useCallback(async () => {
    await writeCache<StoredChoice>(CHOICE_CACHE_KEY, 'declined');
    setHasPrompted('declined');
  }, []);

  return {
    status,
    unsupportedReason,
    /**
     * Whether to show our own sheet. Deliberately false while the stored choice
     * is still loading ('unknown'), so the sheet cannot flash up and then
     * vanish once storage resolves.
     */
    shouldAsk: !unsupportedReason && hasPrompted === null && status === 'idle',
    request,
    decline,
  };
}
