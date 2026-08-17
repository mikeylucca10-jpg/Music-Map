import { Image } from 'expo-image';
import { Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatConcertDateTime } from '@/lib/format-date';
import { getTicketSources, TicketSource } from '@/lib/ticket-sources';
import { ConcertSummary } from '@/types/concert';

type ConcertDetailSheetProps = {
  concert: ConcertSummary | null;
  onClose: () => void;
  isSaved?: boolean;
  isSavePending?: boolean;
  onToggleSave?: () => void;
  /** Precomputed, e.g. "2.3 mi away" — shown only when the viewer has
   * granted location access. */
  distanceLabel?: string;
  /** Precomputed via getDirectionsUrl(concert) — not built here since that
   * needs lat/lng, which ConcertSummary deliberately omits. */
  directionsUrl?: string;
};

export function ConcertDetailSheet({
  concert,
  onClose,
  isSaved,
  isSavePending,
  onToggleSave,
  distanceLabel,
  directionsUrl,
}: ConcertDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  function handleToggleSave() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleSave?.();
  }

  return (
    <Modal visible={concert !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      {concert && (
        <ThemedView
          type="backgroundElement"
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Same URL the card already fetched, so this is normally a cache
                hit and the hero appears without a second download. */}
            {concert.imageUrl && (
              <Image
                source={{ uri: concert.imageUrl }}
                style={styles.heroImage}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
                recyclingKey={concert.id}
                accessible={false}
              />
            )}

            <View style={styles.titleRow}>
              <View style={styles.titleColumn}>
                <ThemedText type="subtitle">
                  {concert.name}
                </ThemedText>
                {concert.artist && concert.artist !== concert.name && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {concert.artist}
                  </ThemedText>
                )}
              </View>
              {onToggleSave && (
                <Pressable
                  onPress={handleToggleSave}
                  disabled={isSavePending}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isSaved ? 'Remove from saved' : 'Save this show'}
                  accessibilityState={{ selected: isSaved, disabled: !!isSavePending }}
                  style={({ pressed }) => (pressed || isSavePending) && styles.pressed}>
                  {/* Icon, not text — see the same note in concert-list-card. */}
                  <ThemedText
                    allowFontScaling={false}
                    style={[styles.heart, isSaved && { color: theme.accentText }]}>
                    {isSaved ? '♥' : '♡'}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {/* Typographic hierarchy rather than an icon per row: the date
                leads at full size/contrast, the address is already visually
                distinct as an accent-coloured link, and the distance recedes
                as secondary text. */}
            <View style={styles.metaRows}>
              <ThemedText type="default">{formatConcertDateTime(concert.startDateTime)}</ThemedText>
              {directionsUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(directionsUrl)}
                  hitSlop={4}
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

            {directionsUrl && (
              <Pressable
                onPress={() => Linking.openURL(directionsUrl)}
                style={({ pressed }) => [styles.directionsWrapper, pressed && styles.pressed]}>
                <ThemedView type="backgroundSelected" style={styles.directionsButton}>
                  <ThemedText type="default">Get Directions</ThemedText>
                  <ThemedText themeColor="textSecondary">›</ThemedText>
                </ThemedView>
              </Pressable>
            )}

            <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.sectionHeading}>
              Buy Tickets
            </ThemedText>
            <View style={styles.sourceList}>
              {getTicketSources(concert).map((source) => (
                <TicketSourceRow key={source.id} source={source} />
              ))}
            </View>
          </ScrollView>
        </ThemedView>
      )}
    </Modal>
  );
}

function TicketSourceRow({ source }: { source: TicketSource }) {
  return (
    <ExternalLink href={source.url as Href & string} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundSelected" style={styles.sourceRow}>
          <View style={[styles.monogram, { backgroundColor: source.color }]}>
            {/* A brand mark standing in for a logo inside a fixed 40pt tile,
                so it does not scale. The source's name is spelled out in full
                on the row beside it, at whatever size the user has set. */}
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.dark.backdrop,
  },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.grabber,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    // Holds the hero's height before the image decodes, so the sheet's content
    // does not jump downward as it arrives.
    backgroundColor: Colors.dark.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  titleColumn: {
    flex: 1,
    gap: Spacing.half,
  },
  // Off-scale on purpose: a single glyph optically centred in its tap area, so
  // these are doing centring work rather than typographic work.
  heart: {
    fontSize: 26,
    lineHeight: 28,
  },
  pressed: {
    opacity: 0.7,
  },
  metaRows: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  // Underlined, not just accent-colored — a color change alone is easy to
  // miss as "this is tappable" versus "this is just emphasized text".
  addressLink: {
    textDecorationLine: 'underline',
  },
  directionsWrapper: {
    paddingHorizontal: Spacing.four,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  sectionHeading: {
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  sourceList: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
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
  sourceLabelColumn: {
    flex: 1,
    gap: Spacing.half,
  },
});
