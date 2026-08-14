import { Link } from 'expo-router';
import { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConcertDetailSheet } from '@/components/concert-detail-sheet';
import { ConcertListCard } from '@/components/concert-list-card';
import { SkeletonCard } from '@/components/skeleton-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { getDirectionsUrl } from '@/lib/directions';
import { distanceLabelFor } from '@/lib/geo';
import { CITIES, Concert } from '@/types/concert';

const FEATURED_CARD_WIDTH = 260;
const FEATURED_CARD_GAP = Spacing.three;

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  const [city, setCity] = useState(CITIES[0]);
  useApplyDefaultCity(profile, setCity);
  const { concerts, isLoading } = useEdmConcerts(city);
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);
  // Read-only here — this screen doesn't render the permission prompt (only
  // Explore does), it just picks up the coords if already granted.
  const { coords: userLocation } = useUserLocation();
  const featured = concerts.slice(0, 6);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / (FEATURED_CARD_WIDTH + FEATURED_CARD_GAP),
    );
    setActiveIndex(Math.max(0, Math.min(index, featured.length - 1)));
  }

  const greetingName = profile?.displayName || session?.user.email?.split('@')[0];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Music Map
            </ThemedText>
            <ThemedText type="title" style={styles.greeting}>
              {greetingName ? `Make plans, ${greetingName}` : 'Make plans'}
            </ThemedText>
          </View>

          <View style={styles.quickLinks}>
            <Link href="/explore" asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.quickLinkPill, { backgroundColor: theme.accent }]}>
                  <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                    Open Map
                  </ThemedText>
                </View>
              </Pressable>
            </Link>
            <Link href="/list" asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.quickLinkPill}>
                  <ThemedText type="smallBold">See Full List</ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          </View>

          <View style={styles.featuredSection}>
            <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.sectionHeading}>
              Upcoming in {city.label}
            </ThemedText>

            {isLoading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}>
                <SkeletonCard width={FEATURED_CARD_WIDTH} />
                <SkeletonCard width={FEATURED_CARD_WIDTH} />
              </ScrollView>
            ) : featured.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                No upcoming EDM shows found right now.
              </ThemedText>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={FEATURED_CARD_WIDTH + FEATURED_CARD_GAP}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleScrollEnd}
                  contentContainerStyle={styles.carouselContent}>
                  {featured.map((concert) => (
                    <ConcertListCard
                      key={concert.id}
                      concert={concert}
                      width={FEATURED_CARD_WIDTH}
                      onPress={() => setSelectedConcert(concert)}
                      isSaved={session ? isSaved(concert.id) : undefined}
                      isSavePending={session ? isSavePending(concert.id) : undefined}
                      onToggleSave={session ? () => toggleSave(concert) : undefined}
                      distanceLabel={distanceLabelFor(userLocation, concert)}
                    />
                  ))}
                </ScrollView>
                <View style={styles.dots}>
                  {featured.map((concert, index) => (
                    <View
                      key={concert.id}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            index === activeIndex ? theme.accent : theme.backgroundElement,
                        },
                      ]}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          {Platform.OS === 'web' && <WebBadge />}
        </ScrollView>
      </SafeAreaView>

      <ConcertDetailSheet
        concert={selectedConcert}
        onClose={() => setSelectedConcert(null)}
        isSaved={selectedConcert && session ? isSaved(selectedConcert.id) : undefined}
        isSavePending={selectedConcert && session ? isSavePending(selectedConcert.id) : undefined}
        onToggleSave={selectedConcert && session ? () => toggleSave(selectedConcert) : undefined}
        distanceLabel={selectedConcert ? distanceLabelFor(userLocation, selectedConcert) : undefined}
        directionsUrl={selectedConcert ? getDirectionsUrl(selectedConcert) : undefined}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: BottomTabInset + Spacing.four,
    alignItems: 'center',
  },
  header: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  greeting: {
    fontSize: 30,
    lineHeight: 34,
  },
  pressed: {
    opacity: 0.75,
  },
  quickLinks: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  quickLinkPill: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  featuredSection: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  sectionHeading: {
    paddingHorizontal: Spacing.four,
  },
  carouselContent: {
    gap: FEATURED_CARD_GAP,
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    paddingHorizontal: Spacing.four,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
