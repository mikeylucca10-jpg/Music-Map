import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ConcertDetailSheet } from '@/components/concert-detail-sheet';
import { ConcertListCard } from '@/components/concert-list-card';
import { ConcertsFilterBar } from '@/components/concerts-filter-bar';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SkeletonCardRow } from '@/components/skeleton-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { useConcertsFilters } from '@/hooks/use-concerts-filters';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { CITIES, Concert } from '@/types/concert';

export default function ListScreen() {
  const [city, setCity] = useState(CITIES[0]);
  const { concerts, isLoading, error, refresh } = useEdmConcerts(city);
  const { category, setCategory, categories, filteredConcerts } = useConcertsFilters(concerts);
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);

  return (
    <ScreenScaffold title="EDM Concerts" subtitle={`Upcoming shows in ${city.label}.`}>
      <ConcertsFilterBar
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
        city={city}
        onCityChange={setCity}
        cities={CITIES}
      />

      {isLoading && (
        <ThemedView style={styles.list}>
          <SkeletonCardRow />
        </ThemedView>
      )}

      {!isLoading && error && (
        <ThemedView type="backgroundElement" style={styles.messageCard}>
          <ThemedText type="small">{error}</ThemedText>
          <Pressable onPress={refresh}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {!isLoading && !error && filteredConcerts.length === 0 && (
        <ThemedView type="backgroundElement" style={styles.messageCard}>
          <ThemedText type="small" themeColor="textSecondary">
            No upcoming EDM shows found right now.
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.list}>
        {filteredConcerts.map((concert) => (
          <ConcertListCard
            key={concert.id}
            concert={concert}
            onPress={() => setSelectedConcert(concert)}
            isSaved={session ? isSaved(concert.id) : undefined}
            isSavePending={session ? isSavePending(concert.id) : undefined}
            onToggleSave={session ? () => toggleSave(concert) : undefined}
          />
        ))}
      </ThemedView>

      <ConcertDetailSheet
        concert={selectedConcert}
        onClose={() => setSelectedConcert(null)}
        isSaved={selectedConcert && session ? isSaved(selectedConcert.id) : undefined}
        isSavePending={selectedConcert && session ? isSavePending(selectedConcert.id) : undefined}
        onToggleSave={selectedConcert && session ? () => toggleSave(selectedConcert) : undefined}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  messageCard: {
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
  },
  list: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
});
