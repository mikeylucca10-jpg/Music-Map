import { useCallback, useState } from 'react';

import { useCachedResource } from '@/hooks/use-cached-resource';
import { fetchProfile, updateProfile as updateProfileRequest } from '@/services/profile';
import { Profile } from '@/types/profile';

export function useProfile(userId: string | null) {
  const fetcher = useCallback(async (): Promise<Profile | null> => {
    if (!userId) return null;
    return fetchProfile(userId);
  }, [userId]);

  const {
    data: profile,
    isLoading,
    error,
    refresh,
  } = useCachedResource<Profile | null>(`profile-${userId ?? 'anonymous'}`, fetcher);

  const [updateError, setUpdateError] = useState<string | null>(null);

  const updateProfile = useCallback(
    async (updates: { displayName?: string }) => {
      if (!userId) return false;
      setUpdateError(null);
      try {
        await updateProfileRequest(userId, updates);
        await refresh();
        return true;
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : 'Failed to update profile.');
        return false;
      }
    },
    [userId, refresh],
  );

  return { profile, isLoading, error: updateError ?? error, updateProfile };
}
