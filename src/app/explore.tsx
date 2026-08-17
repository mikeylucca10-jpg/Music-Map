import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConcertDetailSheet } from '@/components/concert-detail-sheet';
import { ConcertsFilterBar } from '@/components/concerts-filter-bar';
import { ConcertsMap } from '@/components/concerts-map';
import { LocationPermissionPrompt } from '@/components/location-permission-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { useConcertsFilters } from '@/hooks/use-concerts-filters';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { getDirectionsUrl } from '@/lib/directions';
import { distanceLabelFor } from '@/lib/geo';
import { CITIES, Concert } from '@/types/concert';

export default function ExploreScreen() {
  const safeAreaInsets = useSafeAreaInsets();
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
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);
  const theme = useTheme();
  const {
    status: locationStatus,
    coords: userLocation,
    hasPrompted: hasPromptedForLocation,
    canAskAgain,
    requestLocation,
    declineLocation,
  } = useUserLocation();

  // The soft-ask used to slide up the instant the stored choice resolved, which
  // meant a sheet covering the screen before the map had painted — an ambush
  // rather than a question, and with no visible map there was nothing to
  // explain why location was being asked for. A short beat lets the map render
  // first, so the ask arrives with its own context behind it.
  const [mapSettled, setMapSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMapSettled(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ConcertsMap
        concerts={filteredConcerts}
        city={city}
        onSelectConcert={setSelectedConcert}
        userLocation={userLocation}
      />

      {/* Only offered while asking can still do something. Once the OS stops
          showing its dialog, tapping this changed nothing and said nothing —
          it looked like the app was broken. Now it explains where the setting
          actually lives instead. */}
      {locationStatus !== 'granted' && hasPromptedForLocation === true && (
        <Pressable
          onPress={canAskAgain ? requestLocation : undefined}
          disabled={!canAskAgain}
          accessibilityRole={canAskAgain ? 'button' : 'text'}
          accessibilityLabel={
            canAskAgain
              ? 'Show my location on the map'
              : 'Location is blocked. Enable it for this app in your device settings.'
          }
          style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
          <ThemedView type="backgroundElement" style={styles.locationPill}>
            <ThemedText type="smallBold">
              {canAskAgain ? 'Show My Location' : 'Location blocked'}
            </ThemedText>
            {!canAskAgain && (
              <ThemedText type="small" themeColor="textSecondary">
                Turn it on in Settings
              </ThemedText>
            )}
          </ThemedView>
        </Pressable>
      )}

      <View style={[styles.overlayTop, { paddingTop: safeAreaInsets.top + Spacing.two }]}>
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
      </View>

      {(isLoading || error || (!isLoading && filteredConcerts.length === 0)) && (
        <View style={styles.centerOverlay} pointerEvents="box-none">
          <ThemedView type="backgroundElement" style={styles.messageCard}>
            {isLoading && <ActivityIndicator color={theme.accentText} />}
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

      <ConcertDetailSheet
        concert={selectedConcert}
        onClose={() => setSelectedConcert(null)}
        isSaved={selectedConcert && session ? isSaved(selectedConcert.id) : undefined}
        isSavePending={selectedConcert && session ? isSavePending(selectedConcert.id) : undefined}
        onToggleSave={
          selectedConcert && session ? () => toggleSave(selectedConcert) : undefined
        }
        distanceLabel={selectedConcert ? distanceLabelFor(userLocation, selectedConcert) : undefined}
        directionsUrl={selectedConcert ? getDirectionsUrl(selectedConcert) : undefined}
      />

      <LocationPermissionPrompt
        visible={hasPromptedForLocation === false && mapSettled}
        onAllow={requestLocation}
        onDeny={declineLocation}
      />
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
    // Leaflet's own controls use z-index: 1000 internally (see its default
    // CSS) — without a higher value here, the map's zoom buttons paint over
    // the filter bar even though it's later in the DOM.
    zIndex: 1100,
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
    zIndex: 1100,
  },
  messageCard: {
    gap: Spacing.two,
    borderRadius: Radius.card,
    padding: Spacing.four,
    alignItems: 'center',
    maxWidth: 360,
  },
  pressed: {
    opacity: 0.75,
  },
  locationButton: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.four,
    zIndex: 1100,
  },
  locationPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
