import { Image } from 'expo-image';
import { Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
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
};

export function ConcertDetailSheet({
  concert,
  onClose,
  isSaved,
  isSavePending,
  onToggleSave,
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
            {concert.imageUrl && (
              <Image
                source={{ uri: concert.imageUrl }}
                style={styles.heroImage}
                contentFit="cover"
                transition={150}
              />
            )}

            <View style={styles.titleRow}>
              <View style={styles.titleColumn}>
                <ThemedText type="subtitle" style={styles.title}>
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
                  style={({ pressed }) => (pressed || isSavePending) && styles.pressed}>
                  <ThemedText style={[styles.heart, isSaved && { color: theme.accent }]}>
                    {isSaved ? '♥' : '♡'}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <View style={styles.metaRows}>
              <ThemedText type="small" themeColor="textSecondary">
                🗓️ {formatConcertDateTime(concert.startDateTime)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                📍 {concert.venueName}
                {concert.address ? ` · ${concert.address}` : ''}
              </ThemedText>
            </View>

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
            <ThemedText style={styles.monogramText}>{source.monogram}</ThemedText>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
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
    backgroundColor: '#000000',
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
  title: {
    fontSize: 22,
    lineHeight: 26,
  },
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
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sourceLabelColumn: {
    flex: 1,
    gap: Spacing.half,
  },
});
