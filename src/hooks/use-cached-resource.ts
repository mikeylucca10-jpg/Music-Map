import { useCallback, useEffect, useState } from 'react';

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

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetcher();
      setState({ key: cacheKey, data: fresh });
      setError(null);
      setClassified(null);
      writeCache(cacheKey, fresh);
    } catch (err) {
      // Kept alongside the message so screens can tell "no connection" from
      // "the server answered badly" from "this app is misconfigured" — three
      // situations that need three different things from the user.
      setClassified(classifyFetchError(err));
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, fetcher]);

  useEffect(() => {
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
