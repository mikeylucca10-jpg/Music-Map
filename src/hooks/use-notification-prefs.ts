import { useCallback, useState } from 'react';

import { useCachedResource } from '@/hooks/use-cached-resource';
import {
  DEFAULT_NOTIFICATION_PREFS,
  fetchNotificationPrefs,
  NotificationPrefs,
  updateNotificationPrefs,
} from '@/services/notification-prefs';

/**
 * Toggling a notification setting has to feel instant.
 *
 * A switch that waits for a round trip before moving reads as broken, and the
 * usual result is a second tap that undoes the first. So the local value flips
 * immediately and the write happens behind it; if the write fails, the switch
 * goes back to where it was and an error is surfaced rather than leaving the UI
 * quietly disagreeing with the database.
 */
export function useNotificationPrefs(userId: string | null) {
  const fetcher = useCallback(async (): Promise<NotificationPrefs> => {
    if (!userId) return DEFAULT_NOTIFICATION_PREFS;
    return fetchNotificationPrefs(userId);
  }, [userId]);

  const {
    data: stored,
    isLoading,
    error,
    refresh,
  } = useCachedResource<NotificationPrefs>(
    `notification-prefs-${userId ?? 'anonymous'}`,
    fetcher,
  );

  // Holds the optimistic value only while a write is in flight, so a fresh
  // fetch is never fighting a pending toggle for control of the switch.
  const [pending, setPending] = useState<NotificationPrefs | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const prefs = pending ?? stored ?? DEFAULT_NOTIFICATION_PREFS;

  const setPref = useCallback(
    async (key: keyof NotificationPrefs, value: boolean) => {
      if (!userId) return false;
      const next = { ...prefs, [key]: value };
      setPending(next);
      setUpdateError(null);
      try {
        await updateNotificationPrefs(userId, next);
        await refresh();
        return true;
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : 'Could not save that setting.');
        return false;
      } finally {
        // Cleared either way: on success the refreshed value takes over, and on
        // failure the switch snaps back to what is actually stored rather than
        // showing a setting that was never saved.
        setPending(null);
      }
    },
    [userId, prefs, refresh],
  );

  return { prefs, isLoading, error: updateError ?? error, setPref };
}
