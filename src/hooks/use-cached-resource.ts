import { useCallback, useEffect, useRef, useState } from 'react';

import { readCache, writeCache } from '@/lib/cache';
import { classifyFetchError, type ClassifiedError } from '@/lib/errors';

// Stale-while-revalidate: paints instantly from the last cached value (if
// any), then refetches in the background and updates state + cache.
export function useCachedResource<T>(cacheKey: string, fetcher: () => Promise<T>) {
  // Storing the key alongside the data lets us detect a cacheKey change
  // during render (React's documented pattern for this) and drop stale data
  // from the previous key immediately, rather than showing it until the new
  // key's fetch resolves — e.g. anonymous -> signed-in user switching caches.
  const [state, setState] = useState<{ key: string; data: T | null }>({
    key: cacheKey,
    data: null,
  });
  if (state.key !== cacheKey) {
    setState({ key: cacheKey, data: null });
  }
  const data = state.key === cacheKey ? state.data : null;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classified, setClassified] = useState<ClassifiedError | null>(null);

  // Which key the screen is actually showing right now, so a fetch that started
  // under a previous one can tell it has been superseded.
  //
  // The data itself was already safe — the render-phase key check above drops
  // it — but nothing guarded isLoading, error or classified. Switching city
  // while the previous city's request was still in flight let it land and flip
  // isLoading to false, so the new city's screen showed its empty state ("no
  // shows") while it was still loading, and an error from the old city rendered
  // over the new one.
  const activeKey = useRef(cacheKey);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetcher();
      if (activeKey.current !== cacheKey) return;
      setState({ key: cacheKey, data: fresh });
      setError(null);
      setClassified(null);
      // Awaited and caught. Unhandled, a rejected write here surfaced as an
      // unhandled promise rejection rather than as anything anyone could act
      // on — and a cache that fails to write is not a reason to fail the fetch
      // that already succeeded.
      try {
        await writeCache(cacheKey, fresh);
      } catch {
        // Ignored on purpose: the data is already in state and on screen.
      }
    } catch (err) {
      if (activeKey.current !== cacheKey) return;
      // Kept alongside the message so screens can tell "no connection" from
      // "the server answered badly" from "this app is misconfigured" — three
      // situations that need three different things from the user.
      setClassified(classifyFetchError(err));
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      if (activeKey.current === cacheKey) setIsLoading(false);
    }
  }, [cacheKey, fetcher]);

  useEffect(() => {
    // Claimed synchronously, before anything awaits, so an in-flight request
    // from the previous key sees the change the moment it resolves.
    activeKey.current = cacheKey;
    // New cacheKey: show loading again while cache/network resolve for it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    let cancelled = false;
    readCache<T>(cacheKey).then((cached) => {
      if (cancelled || cached === null) return;
      setState((current) =>
        current.key === cacheKey && current.data === null ? { key: cacheKey, data: cached } : current,
      );
    });
    refresh();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, refresh]);

  return { data, isLoading, error, classifiedError: classified, refresh };
}
