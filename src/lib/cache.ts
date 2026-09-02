import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — a failed cache write shouldn't break the app.
  }
}

/**
 * The caches keyed to one account, in the exact shape useCachedResource writes.
 *
 * Kept here rather than in each hook so sign-out has one list to clear and a
 * new per-user cache is one obvious place away from being forgotten.
 */
function perUserCacheKeys(userId: string): string[] {
  return [
    `profile-${userId}`,
    `saved-concerts-${userId}`,
    `follows-${userId}`,
    `notification-prefs-${userId}`,
  ];
}

/**
 * Clears one account's cached data, for sign-out.
 *
 * The next account never *saw* this data — useCachedResource keys on the user
 * id and drops mismatched state during render — so this is not a leak between
 * accounts. It is hygiene at rest: these entries are unencrypted, they outlive
 * the session that created them, and on web they are localStorage rows readable
 * by any script on the origin. Leaving them means an XSS landing after sign-out
 * still yields the previous user's follow list, display name and saved shows.
 *
 * Best-effort by design. Sign-out must not fail because a cache clear did.
 */
export async function clearUserCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove(perUserCacheKeys(userId));
  } catch {
    // Ignored — see above.
  }
}
