import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { FollowChip } from '@/components/follow-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAddToCalendar } from '@/hooks/use-add-to-calendar';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useFollows } from '@/hooks/use-follows';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { getDirectionsUrl } from '@/lib/directions';
import { getSupportActs } from '@/lib/lineup';
import {
  formatConcertDateTimeWithExtras,
  formatTimeZoneAbbreviation,
  shouldShowTimeZone,
} from '@/lib/format-date';
import { distanceLabelFor } from '@/lib/geo';
import { getTicketSources, TicketSource } from '@/lib/ticket-sources';
import { CITIES, Concert, ConcertSummary } from '@/types/concert';



/**
 * A show's own screen, replacing the bottom sheet that used to serve this.
 *
 * A sheet is a preview — it caps at 85% height, it cannot own the poster, and
 * it competes with the list still visible behind it. Everything here wants
 * room: full-bleed art, the ticket sources, and eventually the follow controls
 * that phase 2 adds. Building those into a sheet would only mean moving them.
 *
 * Resolves the concert from the id in the route rather than taking it as a
 * param, so a refresh or a deep link lands on real content instead of an empty
 * screen. Two sources are checked because the two shapes differ: the live feed
 * holds full Concerts with coordinates, while saved concerts are
 * ConcertSummary and deliberately have none.
 */
export default function ConcertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [city, setCity] = useState(CITIES[0]);
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);

  const { concerts, isLoading } = useEdmConcerts(city);
  const { savedConcerts, isSaved, isSavePending, toggleSave } = useSavedConcerts(
    session?.user.id ?? null,
  );
  const { coords: userLocation } = useUserLocation();
  const { state: calendarState, addToCalendar } = useAddToCalendar();
  const { isFollowing, isFollowPending, toggleFollow } = useFollows(session?.user.id ?? null);

  // Prefer the live feed: it carries coordinates, which the saved copy does
  // not, and coordinates are what make directions and distance possible.
  const fullConcert: Concert | undefined = concerts.find((item) => item.id === id);
  const concert: ConcertSummary | undefined =
    fullConcert ?? savedConcerts.find((item) => item.id === id);

  function handleToggleSave() {
    if (!concert) return;
    // Save only, never un-save — see the note in concert-list-card.tsx.
    if (!isSaved(concert.id) && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleSave(concert);
  }

  function goBack() {
    // A deep link or a refresh leaves no history to pop, which would strand
    // someone on a back button that does nothing.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  if (isLoading && !concert) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.accentText} />
      </ThemedView>
    );
  }

  if (!concert) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="smallBold">Show not found</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.notFoundBody}>
          It may have finished, or been removed from the listings.
        </ThemedText>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to shows"
          style={({ pressed }) => [
            styles.backToList,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
            Back to shows
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const directionsUrl = fullConcert ? getDirectionsUrl(fullConcert) : undefined;
  const distanceLabel = fullConcert ? distanceLabelFor(userLocation, fullConcert) : undefined;
  const saved = isSaved(concert.id);
  const supportActs = getSupportActs(concert);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomTabInset }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {concert.imageUrl ? (
            <AnimatedPoster
              sharedTransitionTag={`poster-${concert.id}`}
              source={{ uri: concert.imageUrl }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
              // Same URL the card already fetched, so this is normally a cache
              // hit and the poster is on screen before the transition settles.
              cachePolicy="memory-disk"
              recyclingKey={concert.id}
              accessible={false}
            />
          ) : (
            <ThemedView type="backgroundElement" style={styles.heroImage} />
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleColumn}>
              <ThemedText type="subtitle">{concert.name}</ThemedText>
              {concert.artist && concert.artist !== concert.name && (
                <ThemedText type="small" themeColor="textSecondary">
                  {concert.artist}
                </ThemedText>
              )}
              {/* The whole bill here, uncapped, where the card shows at most
                  three names. This is the screen where someone decides whether
                  to go, and on a four-act club night the fourth name is as
                  likely to be the deciding one as the first. */}
              {supportActs.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  w/ {supportActs.join(', ')}
                </ThemedText>
              )}
            </View>
            {session && (
              <Pressable
                onPress={handleToggleSave}
                disabled={isSavePending(concert.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={saved ? `Remove ${concert.name} from saved` : `Save ${concert.name}`}
                accessibilityState={{ selected: saved, disabled: isSavePending(concert.id) }}
                style={({ pressed }) => (pressed || isSavePending(concert.id)) && styles.pressed}>
                {/* Icon, not text — see the note in concert-list-card.tsx. */}
                <ThemedText
                  allowFontScaling={false}
                  style={[styles.heart, saved && { color: theme.accentText }]}>
                  {saved ? '♥' : '♡'}
                </ThemedText>
              </Pressable>
            )}
          </View>

          {/* Typographic hierarchy rather than an icon per row: the date leads
              at full size, the address is distinct as an accent link, and the
              distance recedes as secondary text. */}
          <View style={styles.metaRows}>
            {/* The zone is spelled out only when the viewer's clock disagrees
                with the venue's — "9:00 PM PDT" read from New York, plain
                "9:00 PM" read from Los Angeles. Stamping it on every row would
                be noise on the overwhelmingly common case of browsing your own
                city, but leaving it off entirely means a cross-country time
                silently reads as local. This is the screen where someone
                decides whether they can actually make it, so it earns the
                clarification here and not on the list card. */}
            <ThemedText type="default">
              {formatConcertDateTimeWithExtras(concert.startDateTime, concert.alsoStartsAt, concert.timezone)}
              {shouldShowTimeZone(concert.startDateTime, concert.timezone)
                ? ` ${formatTimeZoneAbbreviation(concert.startDateTime, concert.timezone)}`
                : ''}
            </ThemedText>
            {directionsUrl ? (
              <Pressable
                onPress={() => Linking.openURL(directionsUrl)}
                hitSlop={4}
                accessibilityRole="link"
                accessibilityLabel={`Directions to ${concert.venueName}`}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="small" style={[styles.addressLink, { color: theme.accentText }]}>
                  {concert.venueName}
                  {concert.address ? ` · ${concert.address}` : ''}
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {concert.venueName}
                {concert.address ? ` · ${concert.address}` : ''}
              </ThemedText>
            )}
            {distanceLabel && (
              <ThemedText type="small" themeColor="textSecondary">
                {distanceLabel}
              </ThemedText>
            )}
          </View>

          {/* Follow lives here, on the screen the show owns, rather than in a
              list card: following is a considered act, not something to fire
              past on a scroll. Artist and venue are separate because they are
              followed for different reasons -- an act you like versus a room
              you trust -- and the research is that a trusted room surfaces acts
              you do not know yet, which following artists alone never will. */}
          {session && (
            <View style={styles.followRow}>
              {concert.artist && (
                <FollowChip
                  label={concert.artist}
                  active={isFollowing('artist', concert.artist)}
                  pending={isFollowPending('artist', concert.artist)}
                  onPress={() => toggleFollow('artist', concert.artist!)}
                />
              )}
              <FollowChip
                label={concert.venueName}
                active={isFollowing('venue', concert.venueName)}
                pending={isFollowPending('venue', concert.venueName)}
                onPress={() => toggleFollow('venue', concert.venueName)}
              />
            </View>
          )}

          {directionsUrl && (
            <Pressable
              onPress={() => Linking.openURL(directionsUrl)}
              accessibilityRole="button"
              accessibilityLabel={`Get directions to ${concert.venueName}`}
              style={({ pressed }) => [styles.directionsWrapper, pressed && styles.pressed]}>
              <ThemedView type="backgroundSelected" style={styles.directionsButton}>
                <ThemedText type="default">Get Directions</ThemedText>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </ThemedView>
            </Pressable>
          )}

          {/* Sits beside Get Directions because both are the same kind of
              thing: taking this show out of the app and into something the
              person already uses to run their life. Saving is a bookmark
              nothing reminds you of; a calendar entry surfaces itself on the
              day, in the app they already trust for that. */}
          <Pressable
            onPress={() => addToCalendar(concert)}
            disabled={calendarState === 'working'}
            accessibilityRole="button"
            accessibilityLabel={
              calendarState === 'added'
                ? `${concert.name} added to your calendar`
                : `Add ${concert.name} to your calendar`
            }
            style={({ pressed }) => [
              styles.directionsWrapper,
              (pressed || calendarState === 'working') && styles.pressed,
            ]}>
            <ThemedView type="backgroundSelected" style={styles.directionsButton}>
              <ThemedText type="default">
                {calendarState === 'added'
                  ? 'Added to Calendar'
                  : calendarState === 'working'
                    ? 'Opening Calendar…'
                    : 'Add to Calendar'}
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {calendarState === 'added' ? '✓' : '›'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          {/* Only ever shown after a real failure. A denied permission is a
              deliberate answer rather than an error, so it is stated plainly
              and points at the one place that can undo it. */}
          {(calendarState === 'denied' || calendarState === 'failed') && (
            <ThemedText type="small" themeColor="textSecondary">
              {calendarState === 'denied'
                ? 'Calendar access is off. You can turn it on for Music Map in your device settings.'
                : "Couldn't open your calendar. The ticket link still has the date."}
            </ThemedText>
          )}

          <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.sectionHeading}>
            Buy Tickets
          </ThemedText>
          <View style={styles.sourceList}>
            {getTicketSources(concert).map((source) => (
              <TicketSourceRow key={source.id} source={source} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Floating over the poster rather than in a header bar: a bar would eat
          the top of the art, which is the one thing this screen exists to show. */}
      <Pressable
        onPress={goBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + Spacing.two },
          pressed && styles.pressed,
        ]}>
        <ThemedText allowFontScaling={false} style={styles.backGlyph}>
          ‹
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function TicketSourceRow({ source }: { source: TicketSource }) {
  return (
    <ExternalLink href={source.url as Href & string} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundSelected" style={styles.sourceRow}>
          <View style={[styles.monogram, { backgroundColor: source.color }]}>
            <ThemedText allowFontScaling={false} style={styles.monogramText}>
              {source.monogram}
            </ThemedText>
          </View>
          <View style={styles.sourceLabelColumn}>
            <ThemedText type="default">{source.label}</ThemedText>
            {source.priceLabel && (
              <ThemedText type="small" themeColor="textSecondary">
                {source.priceLabel}
                {source.isEstimate ? ' (estimate)' : ''}
              </ThemedText>
            )}
          </View>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </ThemedView>
      </Pressable>
    </ExternalLink>
  );
}

/**
 * Same 4:5 the list card uses, so the poster a person tapped is the poster
 * they land on — a different crop here would read as a different image.
 * Tall rather than banner-shaped because on this screen the art is the
 * subject, not a header for the text below it.
 */
const HERO_ASPECT = 4 / 5;

/** Receives the poster handed over from the card it was tapped on. */
const AnimatedPoster = Animated.createAnimatedComponent(Image);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  notFoundBody: { textAlign: 'center' },
  backToList: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  content: { paddingBottom: Spacing.six },
  // Full-bleed: no horizontal padding and no corner radius, so the poster runs
  // to all three edges and reads as the screen rather than a card on it.
  hero: { width: '100%' },
  heroImage: {
    width: '100%',
    aspectRatio: HERO_ASPECT,
    backgroundColor: Colors.dark.background,
  },
  body: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleColumn: { flex: 1, gap: Spacing.half },
  // Off-scale on purpose: a single glyph optically centred in its tap area.
  heart: { fontSize: 26, lineHeight: 28, color: Colors.dark.text },
  metaRows: { gap: Spacing.one },
  followRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  addressLink: { textDecorationLine: 'underline' },
  directionsWrapper: { marginTop: Spacing.one },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  sectionHeading: { marginTop: Spacing.three },
  sourceList: { gap: Spacing.two },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: Radius.card - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    color: Colors.dark.overlayInk,
    fontSize: Fonts.size.xs,
    fontWeight: Fonts.weight.bold,
  },
  sourceLabelColumn: { flex: 1, gap: Spacing.half },
  backButton: {
    position: 'absolute',
    left: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.overlayScrim,
  },
  backGlyph: { fontSize: 26, lineHeight: 28, color: Colors.dark.overlayInk },
  pressed: { opacity: 0.75 },
});
