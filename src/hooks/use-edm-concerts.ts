import { useCallback } from 'react';

import { useCachedResource } from '@/hooks/use-cached-resource';
import { fetchEdmtrainConcerts } from '@/services/edmtrain';
import { fetchTicketmasterConcerts } from '@/services/ticketmaster';
import { City, Concert } from '@/types/concert';

// Same show can come back as two separate listings — most commonly
// Ticketmaster returning separate GA/VIP ticket-tier "events" for the same
// show — so dedupe by name+venue+exact start time. A multi-day
// festival/residency is *not* collapsed by this: each day has a different
// startDateTime, so it's a different key and still shows once per day.
export function dedupeConcerts(concerts: Concert[]): Concert[] {
  const seen = new Set<string>();
  return concerts.filter((concert) => {
    const key = `${concert.name.trim().toLowerCase()}|${concert.venueName.trim().toLowerCase()}|${concert.startDateTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

  return dedupeConcerts([
    ...ticketmasterResult.value,
    ...(edmtrainResult.status === 'fulfilled' ? edmtrainResult.value : []),
  ]).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

export function useEdmConcerts(city: City) {
  const fetcher = useCallback(() => fetchAllConcerts(city), [city]);
  const { data, isLoading, error, classifiedError, refresh } = useCachedResource<Concert[]>(
    `concerts-${city.id}`,
    fetcher,
  );

  return { concerts: data ?? [], isLoading, error, classifiedError, refresh };
}
