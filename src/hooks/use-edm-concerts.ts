import { useCallback } from 'react';

import { useCachedResource } from '@/hooks/use-cached-resource';
import { fetchEdmtrainConcerts } from '@/services/edmtrain';
import { fetchTicketmasterConcerts } from '@/services/ticketmaster';
import { City, Concert } from '@/types/concert';

async function fetchAllConcerts(city: City): Promise<Concert[]> {
  const [ticketmasterResult, edmtrainResult] = await Promise.allSettled([
    fetchTicketmasterConcerts(city),
    fetchEdmtrainConcerts(city),
  ]);

  if (ticketmasterResult.status === 'rejected') {
    throw ticketmasterResult.reason instanceof Error
      ? ticketmasterResult.reason
      : new Error('Failed to load concerts.');
  }

  return [
    ...ticketmasterResult.value,
    ...(edmtrainResult.status === 'fulfilled' ? edmtrainResult.value : []),
  ].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

export function useEdmConcerts(city: City) {
  const fetcher = useCallback(() => fetchAllConcerts(city), [city]);
  const { data, isLoading, error, refresh } = useCachedResource<Concert[]>(
    `concerts-${city.id}`,
    fetcher,
  );

  return { concerts: data ?? [], isLoading, error, refresh };
}
