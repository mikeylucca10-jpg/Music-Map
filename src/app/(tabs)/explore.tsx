import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConcertsFilterBar } from '@/components/concerts-filter-bar';
import { ConcertsMap } from '@/components/concerts-map';
import { LocationPermissionPrompt } from '@/components/location-permission-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { DISTANCE_OPTIONS, useConcertsFilters } from '@/hooks/use-concerts-filters';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useFollows } from '@/hooks/use-follows';
import { useFilterState } from '@/hooks/use-filter-state';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { CITIES } from '@/types/concert';

export default function ExploreScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { session } = useAuth();
  const { follows } = useFollows(session?.user.id ?? null);
  // Shared with the other screen through the tabs-level provider, so paging
  // the week or switching city on one is reflected on the other.
  const { city, setCity } = useFilterState();
  const { concerts, isLoading, error, refresh } = useEdmConcerts(city);
  // Declared before useConcertsFilters, which now takes the coordinates for
  // the distance filter.
  const {
    status: locationStatus,
    coords: userLocation,
    hasPrompted: hasPromptedForLocation,
    canAskAgain,
    unavailableReason,
    requestLocation,
    declineLocation,
  } = useUserLocation();
  const {
    category,
    setCategory,
    categories,
    maxMiles,
    setMaxMiles,
    canFilterByDistance,
    boroughsByCount,
    boroughCounts,
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
    followingOnly,
    setFollowingOnly,
    followCount,
    hasAnyConcerts,
    activeFilters,
    resetFilters,
    filteredConcerts,
  } = useConcertsFilters(concerts, city, follows, userLocation);

  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);
  const theme = useTheme();

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
        onSelectConcert={(concert) => router.push({ pathname: '/concert/[id]', params: { id: concert.id } })}
        userLocation={userLocation}
      />

      {/* Stays a pill. An earlier attempt put the full explanation inline here
          and it became a wall of text across the map, clipped mid-sentence by
          the tab bar — worse than the silence it replaced. The label only has
          to say the button will not help and roughly why; the long version is
          a console warning, because the one case that produces it (an insecure
          dev origin) never happens in an installed app. */}
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
              {canAskAgain
                ? 'Show My Location'
                : unavailableReason
                  ? 'Location needs https'
                  : 'Location blocked · Settings'}
            </ThemedText>
          </ThemedView>
        </Pressable>
      )}

      <View style={[styles.overlayTop, { paddingTop: safeAreaInsets.top + Spacing.two }]}>
        <ConcertsFilterBar
          variant="summary"
          category={category}
          onCategoryChange={setCategory}
          categories={categories}
          city={city}
          onCityChange={setCity}
          cities={CITIES}
          selectedBoroughId={selectedBoroughId}
          maxMiles={maxMiles}
          onMaxMilesChange={setMaxMiles}
          distanceOptions={DISTANCE_OPTIONS}
          canFilterByDistance={canFilterByDistance}
          boroughsByCount={boroughsByCount}
          boroughCounts={boroughCounts}
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
          followingOnly={followingOnly}
          onFollowingOnlyChange={setFollowingOnly}
          followCount={followCount}
          activeFilters={activeFilters}
          onResetFilters={resetFilters}
          resultCount={filteredConcerts.length}
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
            {/* One line, not the list screen's card.

                The map is the content here, so anything drawn over it is in
                the way — a heading, a sentence and a jump button parked in the
                middle of the city was heavier than the fact it was reporting.
                The list already carries the full version, including the jump
                to the next show, and the two screens now share a week: anyone
                who got here from a quiet week on Home has already read it.

                Still not the old "No upcoming EDM shows found right now",
                which claimed the city had nothing while thirty-two listings
                were loaded. Saying *which* week is empty is the whole
                difference, and it costs three words. */}
            {!isLoading && !error && filteredConcerts.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {hasAnyConcerts ? 'Nothing on this week' : 'No shows loaded yet'}
              </ThemedText>
            )}
          </ThemedView>
        </View>
      )}


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
    // Clears the bottom tab bar. At Spacing.four this sat underneath it and
    // got clipped, which was only obvious once the pill grew taller than one
    // line.
    bottom: BottomTabInset + Spacing.three,
    zIndex: 1100,
  },
  locationPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
