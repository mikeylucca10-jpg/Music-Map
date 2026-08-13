import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ConcertListCard } from '@/components/concert-list-card';
import { ConcertsFilterBar } from '@/components/concerts-filter-bar';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useConcertsFilters } from '@/hooks/use-concerts-filters';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { CITIES } from '@/types/concert';

export default function ListScreen() {
  const [city, setCity] = useState(CITIES[0]);
  const { concerts, isLoading, error, refresh } = useEdmConcerts(city);
  const { category, setCategory, categories, filteredConcerts } = useConcertsFilters(concerts);
  const { session } = useAuth();
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);

  return (
    <ScreenScaffold title="EDM Concerts" subtitle="Upcoming shows in NYC.">
      <ConcertsFilterBar
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
        city={city}
        onCityChange={setCity}
        cities={CITIES}
      />

      {isLoading && (
        <ThemedView style={styles.centerState}>
          <ActivityIndicator />
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
            isSaved={session ? isSaved(concert.id) : undefined}
            isSavePending={session ? isSavePending(concert.id) : undefined}
            onToggleSave={session ? () => toggleSave(concert) : undefined}
          />
        ))}
      </ThemedView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  centerState: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  messageCard: {
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
});
