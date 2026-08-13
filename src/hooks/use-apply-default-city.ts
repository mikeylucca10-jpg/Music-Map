import { useEffect, useRef } from 'react';

import { CITIES, City } from '@/types/concert';
import { Profile } from '@/types/profile';

// Applies the user's saved default city to a screen's local city state, once,
// the first time it becomes available — without fighting a manual city
// switch made afterward via the filter bar (the ref latches after applying).
export function useApplyDefaultCity(profile: Profile | null, setCity: (city: City) => void) {
  const hasApplied = useRef(false);

  useEffect(() => {
    if (hasApplied.current || !profile?.defaultCity) return;
    const match = CITIES.find((city) => city.id === profile.defaultCity);
    if (!match) return;
    hasApplied.current = true;
    setCity(match);
  }, [profile, setCity]);
}
