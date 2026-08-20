import { useCallback } from 'react';

import { useCachedResource } from '@/hooks/use-cached-resource';
import { getConcertDateKey } from '@/lib/format-date';
import { fetchEdmtrainConcerts } from '@/services/edmtrain';
import { fetchTicketmasterConcerts } from '@/services/ticketmaster';
import { City, Concert } from '@/types/concert';

/**
 * One card per show per night, carrying every time that show is listed at.
 *
 * Two problems, one answer. The obvious case is the same listing arriving
 * twice — most often Ticketmaster returning separate GA/VIP tier "events" —
 * which an exact name+venue+time key removes. The case that key *missed* is
 * the same show listed twice on one night at different times: Galantis at The
 * Rooftop showed four cards for two nights, at 3pm and 6pm each night, because
 * 19:00Z and 22:00Z are different keys.
 *
 * Simply loosening the key to the calendar day would have destroyed real
 * information. Button Masher at Blue Note is listed at 8:00pm and 10:30pm on
 * one night, and those are two genuinely separate ticketed sets — the club's
 * long-standing early/late format. Nothing in the feed distinguishes that from
 * the Galantis case: there is no `source` field in the response (checked: absent
 * on all 88 listings), and the promoter is identical across the duplicates.
 *
 * So instead of choosing which case to get wrong, both collapse to one card and
 * the times come with it. Galantis reads "3:00 PM & 6:00 PM", which is odd but
 * true — it really is listed at both. Button Masher reads "8:00 PM & 10:30 PM",
 * which is better than two cards, since the point for a Blue Note show is
 * choosing a set. Nothing is hidden either way, which is the property that
 * matters: a missing show is much harder to notice than an extra time.
 *
 * A multi-day run is still one card per day — different days are different
 * keys — so this does not become residency grouping by the back door.
 */
export function dedupeConcerts(concerts: Concert[]): Concert[] {
  const byExactListing = new Map<string, Concert>();
  for (const concert of concerts) {
    const key = `${concert.name.trim().toLowerCase()}|${concert.venueName.trim().toLowerCase()}|${concert.startDateTime}`;
    if (!byExactListing.has(key)) byExactListing.set(key, concert);
  }

  const byNight = new Map<string, Concert>();
  for (const concert of byExactListing.values()) {
    // Keyed on the venue's own calendar day, matching how every other date
    // comparison in the app works. Keying on UTC would file a late show under
    // the following night and split a pair that belongs together.
    const night = getConcertDateKey(new Date(concert.startDateTime), concert.timezone);
    const key = `${concert.name.trim().toLowerCase()}|${concert.venueName.trim().toLowerCase()}|${night}`;
    const existing = byNight.get(key);
    if (!existing) {
      byNight.set(key, concert);
      continue;
    }
    // Earliest listing wins as the representative, so the card's primary time
    // is the first thing happening that night rather than whichever listing the
    // feed happened to return first.
    const [first, second] =
      concert.startDateTime < existing.startDateTime ? [concert, existing] : [existing, concert];
    byNight.set(key, {
      ...first,
      alsoStartsAt: [...(first.alsoStartsAt ?? []), ...(second.alsoStartsAt ?? []), second.startDateTime]
        .filter((time, index, all) => all.indexOf(time) === index)
        .sort(),
    });
  }

  return [...byNight.values()];
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
