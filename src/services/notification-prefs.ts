import { supabase } from '@/lib/supabase';

/**
 * Which alerts a person wants. Mirrors public.notification_prefs.
 *
 * Grouped by *topic* rather than by delivery mechanism, because that is how
 * people think about notifications — "tell me about new shows" is a decision
 * someone can actually make, where "enable push" is not. Granular topic control
 * is also the single biggest lever on long-term opt-in: being able to turn off
 * one kind of message is what stops someone turning off all of them.
 */
export type NotificationPrefs = {
  /** Something you follow announced a show. The reason people follow at all. */
  justAnnounced: boolean;
  /** A show you saved is on tomorrow. Our equivalent of an RSVP reminder. */
  doorsTomorrow: boolean;
  /** A weekly roundup. Marketing by another name, so it defaults off. */
  weeklyDigest: boolean;
};

/**
 * Defaults lean quiet, and deliberately asymmetrically so.
 *
 * The two on by default are things the person explicitly asked for by
 * following an act or saving a show — silence there would break a promise the
 * app made. The digest is something *we* would want to send, so it waits to be
 * asked for. Shipping quiet and letting engaged users opt into more is the
 * documented way to keep opt-in rates from decaying.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  justAnnounced: true,
  doorsTomorrow: true,
  weeklyDigest: false,
};

type PrefsRow = {
  just_announced: boolean;
  doors_tomorrow: boolean;
  weekly_digest: boolean;
};

function fromRow(row: PrefsRow): NotificationPrefs {
  return {
    justAnnounced: row.just_announced,
    doorsTomorrow: row.doors_tomorrow,
    weeklyDigest: row.weekly_digest,
  };
}

export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('just_announced, doors_tomorrow, weekly_digest')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  // No row means untouched defaults rather than an error. A row is only written
  // when someone actually changes something, so the common case is no row.
  return data ? fromRow(data as PrefsRow) : DEFAULT_NOTIFICATION_PREFS;
}

export async function updateNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const { error } = await supabase.from('notification_prefs').upsert(
    {
      user_id: userId,
      just_announced: prefs.justAnnounced,
      doors_tomorrow: prefs.doorsTomorrow,
      weekly_digest: prefs.weeklyDigest,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
