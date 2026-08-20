import { supabase } from '@/lib/supabase';

/**
 * Registers this device's Expo push token against the signed-in user.
 *
 * Keyed on the token rather than the user: one account on a phone and a tablet
 * is two devices, and treating the user as the key would silently stop
 * notifying whichever one registered first.
 *
 * Re-registering the same token is a no-op update rather than an error, which
 * matters because this runs on every launch. Expo tokens are stable but not
 * guaranteed permanent — they can change after a reinstall or a restore — so
 * the safe pattern is to write it every time rather than only once.
 *
 * `disabled_at` is cleared on re-register. A token disabled by a previous
 * DeviceNotRegistered result is a device that had uninstalled or revoked
 * permission; if it is registering again, it is back, and leaving it disabled
 * would mean a reinstall never receives anything again.
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform, disabled_at: null },
    { onConflict: 'token' },
  );
  if (error) throw error;
}

/**
 * Drops this device's token, used on sign-out.
 *
 * Without it, the next person to sign in on a shared device keeps receiving the
 * previous account's alerts — the token stays mapped to a user who is no longer
 * there. Deleted rather than disabled: this is not a dead device, it is a device
 * that should no longer be associated with this account.
 */
export async function unregisterPushToken(token: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').delete().eq('token', token);
  if (error) throw error;
}
