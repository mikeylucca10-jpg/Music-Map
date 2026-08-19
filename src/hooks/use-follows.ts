import { useCallback, useMemo, useState } from 'react';

import { useCachedResource } from '@/hooks/use-cached-resource';
import { addFollow, fetchFollows, Follow, FollowKind, followKey, removeFollow } from '@/services/follows';

/**
 * Following an artist or a venue.
 *
 * Deliberately mirrors useSavedConcerts: same cached-resource backing, same
 * pending-set guard against a double tap firing two overlapping writes. The
 * difference is what a follow *means* — a save is a bookmark, a follow is a
 * standing instruction to be told when something new appears, which is what
 * the alert engine will read.
 */
export function useFollows(userId: string | null) {
  const fetcher = useCallback(async (): Promise<Follow[]> => {
    if (!userId) return [];
    return fetchFollows(userId);
  }, [userId]);

  const { data, isLoading, error, refresh } = useCachedResource<Follow[]>(
    `follows-${userId ?? 'anonymous'}`,
    fetcher,
  );

  const follows = useMemo(() => data ?? [], [data]);

  // Keyed by kind as well as key, so following a venue named after an artist
  // does not light up the artist button too.
  const followedKeys = useMemo(
    () => new Set(follows.map((follow) => `${follow.kind}:${follow.key}`)),
    [follows],
  );

  const [pending, setPending] = useState<Set<string>>(new Set());

  const isFollowing = useCallback(
    (kind: FollowKind, name: string) => followedKeys.has(`${kind}:${followKey(name)}`),
    [followedKeys],
  );

  const isFollowPending = useCallback(
    (kind: FollowKind, name: string) => pending.has(`${kind}:${followKey(name)}`),
    [pending],
  );

  const toggleFollow = useCallback(
    async (kind: FollowKind, name: string) => {
      const id = `${kind}:${followKey(name)}`;
      if (!userId || pending.has(id)) return;
      setPending((current) => new Set(current).add(id));
      try {
        if (followedKeys.has(id)) await removeFollow(userId, kind, name);
        else await addFollow(userId, kind, name);
        await refresh();
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    },
    [userId, pending, followedKeys, refresh],
  );

  return { follows, isLoading, error, isFollowing, isFollowPending, toggleFollow, refresh };
}
