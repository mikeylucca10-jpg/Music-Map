import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ConcertListCard } from '@/components/concert-list-card';
import { ConcertsFilterBar } from '@/components/concerts-filter-bar';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SkeletonCardRow } from '@/components/skeleton-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { useConcertsFilters } from '@/hooks/use-concerts-filters';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useFollows } from '@/hooks/use-follows';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useUserLocation } from '@/hooks/use-user-location';
import { useTheme } from '@/hooks/use-theme';
import { formatConcertDateTime } from '@/lib/format-date';
import { distanceLabelFor } from '@/lib/geo';
import { CITIES, ConcertSummary } from '@/types/concert';

// This is the full concert list — it used to live at /list while Home showed
// a featured carousel of the same shows. The two were near-duplicates, so the
// list took over as the landing screen and the carousel was dropped.
export default function HomeScreen() {
  const [city, setCity] = useState(CITIES[0]);
  const { concerts, isLoading, error, classifiedError, refresh } = useEdmConcerts(city);
  const { session } = useAuth();
  const { follows } = useFollows(session?.user.id ?? null);
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
    weekNights,
    followingOnly,
    setFollowingOnly,
    followCount,
    nextShowAhead,
    hasAnyConcerts,
    activeFilters,
    resetFilters,
    filteredConcerts,
  } = useConcertsFilters(concerts, city, follows);
  const theme = useTheme();
  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);

  // Read-only here — this screen doesn't render the permission prompt (only
  // Explore does), it just picks up the coords if already granted.
  const { coords: userLocation } = useUserLocation();

  // Hoisted so every row shares one function identity. Each card previously got
  // a freshly minted arrow on every render, which would defeat ConcertListCard's
  // memo no matter what else stayed equal.
  //
  // The card only knows ConcertSummary, which deliberately carries no
  // coordinates, but the detail sheet needs the full Concert for distance and
  // directions — so recover it by id rather than casting the summary back up.
  const handleSelectConcert = useCallback(
    (summary: ConcertSummary) => {
      router.push({ pathname: '/concert/[id]', params: { id: summary.id } });
    },
    [],
  );
  const handleToggleSave = useCallback(
    (concert: ConcertSummary) => toggleSave(concert),
    [toggleSave],
  );

  // No subtitle: "Live shows in New York." only restated the city pill directly
  // beneath it, and spent a line of the first screen doing so.
  return (
    <ScreenScaffold title="Music Map">
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
        weekNights={weekNights}
        followingOnly={followingOnly}
        onFollowingOnlyChange={setFollowingOnly}
        followCount={followCount}
        resultCount={filteredConcerts.length}
        activeFilters={activeFilters}
        onResetFilters={resetFilters}
      />

      {isLoading && (
        <ThemedView style={styles.list}>
          <SkeletonCardRow />
        </ThemedView>
      )}

      {/* Three distinct failures, three messages: no connection, a server that
          answered badly, and an app missing its API key. The last one hides the
          retry, because retrying cannot fix a missing key and offering it just
          produces the same error again. */}
      {!isLoading && error && classifiedError && (
        <ThemedView type="backgroundElement" style={styles.messageCard}>
          <ThemedText type="smallBold">{classifiedError.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.messageBody}>
            {classifiedError.body}
          </ThemedText>
          {classifiedError.retryable && (
            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel="Retry loading shows"
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="linkPrimary">Try again</ThemedText>
            </Pressable>
          )}
        </ThemedView>
      )}

      {/* Never claims there are no shows while the dataset holds some — the
          previous copy said "No upcoming EDM shows found right now" on a week
          with nothing on it, while 85 upcoming shows were loaded. An empty
          week now says so, and offers the soonest show as a one-tap jump
          rather than dead-ending. */}
      {!isLoading && !error && filteredConcerts.length === 0 && (
        <ThemedView type="backgroundElement" style={styles.messageCard}>
          <ThemedText type="smallBold">
            {hasAnyConcerts ? 'Nothing on this week' : 'No shows loaded yet'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.messageBody}>
            {hasAnyConcerts
              ? nextShowAhead
                ? 'This week is quiet. The next show is:'
                : 'Nothing matches these filters. Try another week, borough, or category.'
              : 'Pull to refresh, or check back shortly.'}
          </ThemedText>
          {nextShowAhead && (
            <Pressable
              onPress={() => setWeekOffset(nextShowAhead.weekOffset)}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${formatConcertDateTime(nextShowAhead.concert.startDateTime)}, ${nextShowAhead.concert.name}`}
              style={({ pressed }) => [
                styles.jumpButton,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                {formatConcertDateTime(nextShowAhead.concert.startDateTime)}
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      )}

      <ThemedView style={styles.list}>
        {filteredConcerts.map((concert) => (
          <ConcertListCard
            key={concert.id}
            concert={concert}
            onPress={handleSelectConcert}
            isSaved={session ? isSaved(concert.id) : undefined}
            isSavePending={session ? isSavePending(concert.id) : undefined}
            onToggleSave={session ? handleToggleSave : undefined}
            distanceLabel={distanceLabelFor(userLocation, concert)}
          />
        ))}
      </ThemedView>

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
  messageBody: {
    textAlign: 'center',
  },
  jumpButton: {
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.75,
  },
  list: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
});
