import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatConcertDateTime } from '@/lib/format-date';
import { ConcertSummary } from '@/types/concert';

type ConcertListCardProps = {
  concert: ConcertSummary;
  onPress?: () => void;
  isSaved?: boolean;
  isSavePending?: boolean;
  onToggleSave?: () => void;
  /** Fixed width — use inside a horizontal carousel (e.g. Home's featured row). */
  width?: number;
  /** Precomputed (not raw coordinates — ConcertSummary intentionally omits
   * those) e.g. "2.3 mi away", shown only when the viewer has granted
   * location access. */
  distanceLabel?: string;
};

export function ConcertListCard({
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
    onToggleSave?.();
  }

  const heartIcon = (
    <ThemedText style={[styles.heart, isSaved && { color: theme.accent }]}>
      {isSaved ? '♥' : '♡'}
    </ThemedText>
  );

  const card = concert.imageUrl ? (
    <View style={[styles.card, width ? { width } : styles.cardFullWidth]}>
      <Image source={{ uri: concert.imageUrl }} style={styles.image} contentFit="cover" transition={150} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.55, 1]}
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
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
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
    backgroundColor: '#000000',
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
  overlayTitle: {
    fontSize: 19,
    lineHeight: 22,
    color: '#ffffff',
  },
  overlayMeta: {
    color: 'rgba(255, 255, 255, 0.82)',
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
  heartButtonOverlay: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    fontSize: 20,
    lineHeight: 22,
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.75,
  },
});
