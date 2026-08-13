import { Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { Concert } from '@/types/concert';

// Hardcoded to NYC's timezone since that's the only city CITIES has today
// (src/types/concert.ts) — revisit with a per-city timezone once more cities
// are added, otherwise a device outside US-Eastern shows the wrong local hour.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

type ConcertCardData = Pick<
  Concert,
  'id' | 'name' | 'url' | 'startDateTime' | 'venueName' | 'address'
>;

type ConcertListCardProps = {
  concert: ConcertCardData;
  onPress?: () => void;
  isSaved?: boolean;
  isSavePending?: boolean;
  onToggleSave?: () => void;
};

export function ConcertListCard({
  concert,
  onPress,
  isSaved,
  isSavePending,
  onToggleSave,
}: ConcertListCardProps) {
  const content = (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.titleRow}>
        <ThemedText type="default" style={styles.title}>
          {concert.name}
        </ThemedText>
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
      <ThemedText type="small" themeColor="textSecondary">
        {dateFormatter.format(new Date(concert.startDateTime))}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {concert.venueName}
        {concert.address ? ` · ${concert.address}` : ''}
      </ThemedText>
      <ExternalLink href={concert.url as Href & string}>
        <ThemedText type="linkPrimary">Get Tickets →</ThemedText>
      </ExternalLink>
    </ThemedView>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  heart: {
    fontSize: 20,
    lineHeight: 22,
  },
  heartSaved: {
    fontSize: 20,
    lineHeight: 22,
    color: '#e5484d',
  },
  pressed: {
    opacity: 0.7,
  },
});
