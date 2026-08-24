import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { CITIES, type City } from '@/types/concert';
import type { Category } from '@/hooks/use-concerts-filters';

/**
 * Everything the list and the map both filter by, held in one place.
 *
 * Home and Explore each used to own a private copy of all of this. They are
 * two views of one dataset, so the copies drifted the moment you touched
 * either: paging Home to a later week and switching to the map showed the map
 * still sitting on the current one, with no indication anything differed.
 *
 * That reads as a data bug rather than a state one, and in Los Angeles it
 * looked exactly like a missing feed — the current week there has no shows at
 * all, so a map that quietly stayed on it said "no shows found" about a city
 * with thirty-two upcoming listings, eleven of them in the very week the list
 * behind it was already showing.
 *
 * A context rather than a store library: this is seven values with no async
 * behaviour, no middleware and one writer per value, and the app deliberately
 * carries no Redux-scale tooling.
 */
type FilterState = {
  city: City;
  setCity: Dispatch<SetStateAction<City>>;
  followingOnly: boolean;
  setFollowingOnly: Dispatch<SetStateAction<boolean>>;
  category: Category;
  setCategory: Dispatch<SetStateAction<Category>>;
  boroughId: string | null;
  setBoroughId: Dispatch<SetStateAction<string | null>>;
  dateKey: string | null;
  setDateKey: Dispatch<SetStateAction<string | null>>;
  weekOffset: number;
  setWeekOffset: Dispatch<SetStateAction<number>>;
  maxMiles: number | null;
  setMaxMiles: Dispatch<SetStateAction<number | null>>;
  /** Backs the city-change reset in useConcertsFilters — see the note there. */
  lastCityId: string;
  setLastCityId: Dispatch<SetStateAction<string>>;
};

const FilterStateContext = createContext<FilterState | null>(null);

export function FilterStateProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState<City>(CITIES[0]);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [category, setCategory] = useState<Category>('All');
  const [boroughId, setBoroughId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [maxMiles, setMaxMiles] = useState<number | null>(null);
  const [lastCityId, setLastCityId] = useState(CITIES[0].id);

  const value = useMemo(
    () => ({
      city,
      setCity,
      followingOnly,
      setFollowingOnly,
      category,
      setCategory,
      boroughId,
      setBoroughId,
      dateKey,
      setDateKey,
      weekOffset,
      setWeekOffset,
      maxMiles,
      setMaxMiles,
      lastCityId,
      setLastCityId,
    }),
    [city, followingOnly, category, boroughId, dateKey, weekOffset, maxMiles, lastCityId],
  );

  return <FilterStateContext.Provider value={value}>{children}</FilterStateContext.Provider>;
}

/**
 * Throws rather than falling back to a private default. A silent fallback would
 * give each screen its own state again — the exact bug this replaced, back but
 * harder to see, since everything would still work in isolation.
 */
export function useFilterState() {
  const value = useContext(FilterStateContext);
  if (!value) {
    throw new Error('useFilterState must be used inside a FilterStateProvider');
  }
  return value;
}
