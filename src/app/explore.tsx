import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConcertListCard } from '@/components/concert-list-card';
import { ConcertsFilterBar } from '@/components/concerts-filter-bar';
import { ConcertsMap } from '@/components/concerts-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useConcertsFilters } from '@/hooks/use-concerts-filters';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { CITIES, Concert } from '@/types/concert';

export default function ExploreScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const [city, setCity] = useState(CITIES[0]);
  const { concerts, isLoading, error, refresh } = useEdmConcerts(city);
  const { category, setCategory, categories, filteredConcerts } = useConcertsFilters(concerts);
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);
  const { session } = useAuth();
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);

  return (
    <ThemedView style={styles.container}>
      <ConcertsMap concerts={filteredConcerts} city={city} onSelectConcert={setSelectedConcert} />

      <View style={[styles.overlayTop, { paddingTop: safeAreaInsets.top + Spacing.two }]}>
        <ConcertsFilterBar
          category={category}
          onCategoryChange={setCategory}
          categories={categories}
          city={city}
          onCityChange={setCity}
          cities={CITIES}
        />
      </View>

      {(isLoading || error || (!isLoading && filteredConcerts.length === 0)) && (
        <View style={styles.centerOverlay} pointerEvents="box-none">
          <ThemedView type="backgroundElement" style={styles.messageCard}>
            {isLoading && <ActivityIndicator />}
            {!isLoading && error && (
              <>
                <ThemedText type="small">{error}</ThemedText>
                <Pressable onPress={refresh}>
                  <ThemedText type="linkPrimary">Retry</ThemedText>
                </Pressable>
              </>
            )}
            {!isLoading && !error && filteredConcerts.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                No upcoming EDM shows found right now.
              </ThemedText>
            )}
          </ThemedView>
        </View>
      )}

      {selectedConcert && (
        <View
          style={[
            styles.detailPanel,
            { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three },
          ]}>
          <ConcertListCard
            concert={selectedConcert}
            isSaved={session ? isSaved(selectedConcert.id) : undefined}
            isSavePending={session ? isSavePending(selectedConcert.id) : undefined}
            onToggleSave={session ? () => toggleSave(selectedConcert) : undefined}
          />
          <Pressable
            onPress={() => setSelectedConcert(null)}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.closeButtonInner}>
              <ThemedText type="smallBold">Close</ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  messageCard: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
    maxWidth: 360,
  },
  detailPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  closeButton: {
    alignSelf: 'center',
  },
  closeButtonInner: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
});
