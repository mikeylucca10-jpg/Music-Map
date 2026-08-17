import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { readCache, writeCache } from '@/lib/cache';

const CHOICE_CACHE_KEY = 'location-prompt-choice';

// 'declined' = the user explicitly tapped "Not Now" — respect that and stay
// quiet. 'requested' = they tapped "Turn On Location" at some point, which
// is NOT the same as still being granted: browsers offer a temporary
// "Allow once" option that expires on reload, and PermissionStatus will
// correctly report back to 'undetermined' afterward. In that case we want
// to re-show the soft-ask rather than silently doing nothing, since the
// user showed clear intent — they just picked the temporary browser option.
type StoredChoice = 'declined' | 'requested';

export type UserLocationStatus = 'idle' | 'granted' | 'denied';

// Best-effort — a failed/unsupported position fetch (timeout,
// POSITION_UNAVAILABLE, or an older browser without navigator.permissions,
// which makes getForegroundPermissionsAsync itself throw) shouldn't leave
// the hook hanging with hasPrompted stuck at null forever, since that would
// hide both the soft-ask sheet and the "Show My Location" retry pill with
// no way back in.
async function getCurrentCoords() {
  try {
    const position = await Location.getCurrentPositionAsync({});
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}

// Manages the app's own soft-ask ("Turn On Location" / "Not Now") separately
// from the OS's hard permission dialog: requestLocation() only triggers the
// real OS prompt once the user has already opted in through our UI.
export function useUserLocation() {
  const [status, setStatus] = useState<UserLocationStatus>('idle');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  // null while still loading from storage/OS — callers should treat that as
  // "not yet known" rather than "should prompt".
  const [hasPrompted, setHasPrompted] = useState<boolean | null>(null);
  /**
   * False once the OS or browser has stopped offering the permission dialog —
   * after a hard denial it silently resolves every request as denied without
   * showing anything.
   *
   * Without this the retry affordance is a dead end: tapping it calls
   * requestForegroundPermissionsAsync(), no dialog appears, nothing changes,
   * and the user is given no reason why. Screens read this to explain that the
   * decision now lives in system settings rather than offering a retry that
   * cannot work.
   */
  const [canAskAgain, setCanAskAgain] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let choice: StoredChoice | null = null;
      let existingStatus: Location.PermissionStatus = Location.PermissionStatus.UNDETERMINED;
      try {
        const [choiceResult, existing] = await Promise.all([
          readCache<StoredChoice>(CHOICE_CACHE_KEY),
          Location.getForegroundPermissionsAsync(),
        ]);
        choice = choiceResult;
        existingStatus = existing.status;
      } catch {
        // Treat as "not yet decided" so the soft-ask still shows rather than
        // the whole hook getting stuck.
      }
      if (cancelled) return;

      if (existingStatus === 'granted') {
        setStatus('granted');
        const position = await getCurrentCoords();
        if (!cancelled && position) setCoords(position);
      } else if (existingStatus === 'denied') {
        // Reflect a standing denial on load, not just after a failed request,
        // so the retry pill never appears offering something that cannot work.
        setStatus('denied');
      }
      // Only a real OS-level decision (granted/denied) or an explicit "Not
      // Now" suppresses the sheet — a lapsed "allow once" grant (status back
      // to 'undetermined', choice still 'requested') re-shows it.
      setHasPrompted(existingStatus !== 'undetermined' || choice === 'declined');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestLocation = useCallback(async () => {
    writeCache<StoredChoice>(CHOICE_CACHE_KEY, 'requested');
    setHasPrompted(true);

    let result: Location.LocationPermissionResponse;
    try {
      result = await Location.requestForegroundPermissionsAsync();
    } catch {
      // Older browsers without navigator.permissions throw rather than resolve.
      setStatus('denied');
      setCanAskAgain(false);
      return;
    }

    // canAskAgain false means the dialog will never appear again, so callers
    // must stop offering a retry and point at system settings instead.
    setCanAskAgain(result.canAskAgain ?? true);

    if (result.status === 'granted') {
      setStatus('granted');
      const position = await getCurrentCoords();
      if (position) setCoords(position);
    } else {
      setStatus('denied');
    }
  }, []);

  const declineLocation = useCallback(() => {
    writeCache<StoredChoice>(CHOICE_CACHE_KEY, 'declined');
    setHasPrompted(true);
    setStatus('denied');
  }, []);

  return { status, coords, hasPrompted, canAskAgain, requestLocation, declineLocation };
}
