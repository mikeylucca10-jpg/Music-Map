import { Href } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatConcertDateTime } from '@/lib/format-date';
import { getTicketSources, TicketSource } from '@/lib/ticket-sources';
import { Concert } from '@/types/concert';

type ConcertDetailSheetProps = {
  concert: Concert | null;
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

  return (
    <Modal visible={concert !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      {concert && (
        <ThemedView
          type="background"
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                  onPress={onToggleSave}
                  disabled={isSavePending}
                  hitSlop={8}
                  style={({ pressed }) => (pressed || isSavePending) && styles.pressed}>
                  <ThemedText style={isSaved ? styles.heartSaved : styles.heart}>
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

            <ThemedText type="smallBold" style={styles.sectionHeading}>
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
        <ThemedView type="backgroundElement" style={styles.sourceRow}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleColumn: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  heart: {
    fontSize: 26,
    lineHeight: 28,
  },
  heartSaved: {
    fontSize: 26,
    lineHeight: 28,
    color: '#e5484d',
  },
  pressed: {
    opacity: 0.7,
  },
  metaRows: {
    gap: Spacing.one,
  },
  sectionHeading: {
    marginTop: Spacing.one,
  },
  sourceList: {
    gap: Spacing.two,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
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
