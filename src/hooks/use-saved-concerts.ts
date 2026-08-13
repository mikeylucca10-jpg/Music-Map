import { useCallback, useMemo, useState } from 'react';

import { useCachedResource } from '@/hooks/use-cached-resource';
import { fetchSavedConcerts, saveConcert, unsaveConcert } from '@/services/saved-concerts';
import { SavedConcert } from '@/types/concert';

export function useSavedConcerts(userId: string | null) {
  const fetcher = useCallback(async (): Promise<SavedConcert[]> => {
    if (!userId) return [];
    return fetchSavedConcerts(userId);
  }, [userId]);

  const { data, isLoading, error, refresh } = useCachedResource<SavedConcert[]>(
    `saved-concerts-${userId ?? 'anonymous'}`,
    fetcher,
  );

  const savedConcerts = data ?? [];
  const savedIds = useMemo(() => new Set((data ?? []).map((c) => c.id)), [data]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggleSave = useCallback(
    async (concert: SavedConcert) => {
      // Guards against a double-tap firing two overlapping saves/unsaves for
      // the same concert, which would otherwise hit the DB's unique constraint.
      if (!userId || pendingIds.has(concert.id)) return;
      setPendingIds((current) => new Set(current).add(concert.id));
      setToggleError(null);
      try {
        if (savedIds.has(concert.id)) {
          await unsaveConcert(userId, concert.id);
        } else {
          await saveConcert(userId, concert);
        }
        await refresh();
      } catch (err) {
        setToggleError(err instanceof Error ? err.message : 'Failed to update saved concerts.');
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(concert.id);
          return next;
        });
      }
    },
    [userId, savedIds, pendingIds, refresh],
  );

  const isSaved = useCallback((concertId: string) => savedIds.has(concertId), [savedIds]);
  const isSavePending = useCallback((concertId: string) => pendingIds.has(concertId), [pendingIds]);

  return {
    savedConcerts,
    isSaved,
    isSavePending,
    isLoading,
    error: toggleError ?? error,
    toggleSave,
  };
}
