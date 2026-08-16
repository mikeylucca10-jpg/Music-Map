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
import { useUserLocation } from '@/hooks/use-user-location';
import { getDirectionsUrl } from '@/lib/directions';
import { distanceLabelFor } from '@/lib/geo';
import { CITIES, Concert } from '@/types/concert';

// This is the full concert list — it used to live at /list while Home showed
// a featured carousel of the same shows. The two were near-duplicates, so the
// list took over as the landing screen and the carousel was dropped.
export default function HomeScreen() {
  const [city, setCity] = useState(CITIES[0]);
  const { concerts, isLoading, error, refresh } = useEdmConcerts(city);
  const {
    category,
    setCategory,
    categories,
    selectedBoroughId,
    setBoroughId,
    selectedDateKey,
    setDateKey,
    weekLabel,
    goToPrevWeek,
    goToNextWeek,
    canGoPrevWeek,
    canGoNextWeek,
    weekNavRelevant,
    setWeekOffset,
    filteredConcerts,
  } = useConcertsFilters(concerts, city);
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);
  // Read-only here — this screen doesn't render the permission prompt (only
  // Explore does), it just picks up the coords if already granted.
  const { coords: userLocation } = useUserLocation();

  return (
    <ScreenScaffold title="Music Map" subtitle={`Live shows in ${city.label}.`}>
      <ConcertsFilterBar
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
        city={city}
        onCityChange={setCity}
        cities={CITIES}
        selectedBoroughId={selectedBoroughId}
        onBoroughChange={setBoroughId}
        selectedDateKey={selectedDateKey}
        onDateChange={setDateKey}
        weekLabel={weekLabel}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
        canGoPrevWeek={canGoPrevWeek}
        canGoNextWeek={canGoNextWeek}
        weekNavRelevant={weekNavRelevant}
        setWeekOffset={setWeekOffset}
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
            distanceLabel={distanceLabelFor(userLocation, concert)}
          />
        ))}
      </ThemedView>

      <ConcertDetailSheet
        concert={selectedConcert}
        onClose={() => setSelectedConcert(null)}
        isSaved={selectedConcert && session ? isSaved(selectedConcert.id) : undefined}
        isSavePending={selectedConcert && session ? isSavePending(selectedConcert.id) : undefined}
        onToggleSave={selectedConcert && session ? () => toggleSave(selectedConcert) : undefined}
        distanceLabel={selectedConcert ? distanceLabelFor(userLocation, selectedConcert) : undefined}
        directionsUrl={selectedConcert ? getDirectionsUrl(selectedConcert) : undefined}
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
