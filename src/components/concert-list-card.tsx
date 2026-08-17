import { memo } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, PosterGradient, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatConcertDateTime } from '@/lib/format-date';
import { ConcertSummary } from '@/types/concert';

/**
 * Colours here read from `Colors.dark` directly rather than `useTheme()`
 * because they sit inside StyleSheet.create, which is evaluated once at module
 * load. That is safe precisely because this app is dark-only by design —
 * `Colors.light` and `Colors.dark` are the same object. If a real light theme
 * is ever added, every one of these has to move into the component body.
 */
const HEART_BUTTON_SIZE = 36;

type ConcertListCardProps = {
  concert: ConcertSummary;
  /** Receives the concert so callers can hoist one stable handler for the list. */
  onPress?: (concert: ConcertSummary) => void;
  isSaved?: boolean;
  isSavePending?: boolean;
  onToggleSave?: (concert: ConcertSummary) => void;
  /** Fixed width — use inside a horizontal carousel (e.g. Home's featured row). */
  width?: number;
  /** Precomputed (not raw coordinates — ConcertSummary intentionally omits
   * those) e.g. "2.3 mi away", shown only when the viewer has granted
   * location access. */
  distanceLabel?: string;
};

/**
 * Memoized: every row re-rendered on any parent state change before this,
 * because the list rebuilt an inline arrow per card on every pass.
 *
 * The memo only pays off if callers pass *stable* callbacks, which is why
 * `onPress` and `onToggleSave` receive the concert rather than closing over it
 * — a parent can now hoist one `useCallback` for the whole list instead of
 * minting a fresh closure per row. Every other prop compares by value.
 */
function ConcertListCardComponent({
  concert,
  onPress,
  isSaved,
  isSavePending,
  onToggleSave,
  width,
  distanceLabel,
}: ConcertListCardProps) {
  const theme = useTheme();

  function handleToggleSave() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleSave?.(concert);
  }

  const heartIcon = (
    <ThemedText style={[styles.heart, isSaved && { color: theme.accentText }]}>
      {isSaved ? '♥' : '♡'}
    </ThemedText>
  );

  // The glyph is the only thing in this button, so without an explicit label a
  // screen reader announces "heart" (or nothing) rather than what tapping does.
  // Naming the concert matters here because a list renders many of these and
  // "Save" alone would repeat identically down the whole screen.
  const saveButtonA11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: isSaved ? `Remove ${concert.name} from saved` : `Save ${concert.name}`,
    accessibilityState: { selected: isSaved, disabled: !!isSavePending },
  };

  const card = concert.imageUrl ? (
    <View style={[styles.card, width ? { width } : styles.cardFullWidth]}>
      {/* memory-disk rather than the disk default: paging weeks revisits the
          same posters constantly, and a memory hit skips re-decoding a ~1024px
          JPEG. recyclingKey tells expo-image the view now shows a different
          concert, so a recycled row cannot briefly paint the previous poster.
          The box is already reserved by aspectRatio + the background fill, so
          nothing reflows when the image lands. */}
      <Image
        source={{ uri: concert.imageUrl }}
        style={styles.image}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={concert.id}
        accessible={false}
      />
      <LinearGradient
        colors={[...PosterGradient.colors]}
        locations={[...PosterGradient.locations]}
        style={styles.gradient}
      />
      <View style={styles.overlayText}>
        <ThemedText type="subtitle" style={styles.overlayTitle} numberOfLines={2}>
          {concert.name}
        </ThemedText>
        <ThemedText type="small" style={styles.overlayMeta} numberOfLines={1}>
          {formatConcertDateTime(concert.startDateTime)} · {concert.venueName}
          {distanceLabel ? ` · ${distanceLabel}` : ''}
        </ThemedText>
      </View>
      {onToggleSave && (
        <Pressable
          {...saveButtonA11y}
          onPress={handleToggleSave}
          disabled={isSavePending}
          hitSlop={8}
          style={({ pressed }) => [
            styles.heartButtonOverlay,
            (pressed || isSavePending) && styles.pressed,
          ]}>
          {heartIcon}
        </Pressable>
      )}
    </View>
  ) : (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, styles.noImageCard, width ? { width } : styles.cardFullWidth]}>
      <View style={styles.titleRow}>
        <ThemedText type="default" style={styles.noImageTitle} numberOfLines={2}>
          {concert.name}
        </ThemedText>
        {onToggleSave && (
          <Pressable
            {...saveButtonA11y}
            onPress={handleToggleSave}
            disabled={isSavePending}
            hitSlop={8}
            style={({ pressed }) => (pressed || isSavePending) && styles.pressed}>
            {heartIcon}
          </Pressable>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {formatConcertDateTime(concert.startDateTime)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {concert.venueName}
        {distanceLabel ? ` · ${distanceLabel}` : ''}
      </ThemedText>
    </ThemedView>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${concert.name} at ${concert.venueName}`}
      accessibilityHint="Opens show details and ticket options"
      onPress={() => onPress(concert)}
      style={({ pressed }) => pressed && styles.pressed}>
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  cardFullWidth: {
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 5,
    // Reserves the card's full height before the image decodes, so arriving
    // art swaps in place instead of shoving the rest of the list downward.
    backgroundColor: Colors.dark.background,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
  },
  overlayText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  // `lg` is the scale step sized for this: 1.32 leading, because lineup-style
  // names ("Henry Tegethoff, Guy Renée, Coldsteel, Dopema") routinely wrap to
  // two or three lines and tighter leading packs them into one unreadable block.
  overlayTitle: {
    fontSize: Fonts.size.lg,
    lineHeight: Fonts.lineHeight.lg,
    color: Colors.dark.overlayInk,
  },
  overlayMeta: {
    color: Colors.dark.overlayInkMuted,
  },
  noImageCard: {
    gap: Spacing.one,
    padding: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  noImageTitle: {
    flex: 1,
    fontWeight: '700',
  },
  // 36pt visually, but rendered with hitSlop={8} for a 52pt touch target —
  // comfortably past MinTouchTarget. Sized down deliberately: a full 44pt disc
  // sitting on the artwork reads as a badge rather than a control.
  heartButtonOverlay: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: HEART_BUTTON_SIZE,
    height: HEART_BUTTON_SIZE,
    borderRadius: HEART_BUTTON_SIZE / 2,
    backgroundColor: Colors.dark.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Off-scale on purpose: this is a single glyph optically centred in a fixed
  // disc, so the line height is doing centring work, not typographic work.
  heart: {
    fontSize: 20,
    lineHeight: 22,
    color: Colors.dark.overlayInk,
  },
  pressed: {
    opacity: 0.75,
  },
});

export const ConcertListCard = memo(ConcertListCardComponent);
