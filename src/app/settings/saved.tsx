import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConcertListCard } from '@/components/concert-list-card';
import { SettingsDetailScreen } from '@/components/settings-detail-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { ConcertSummary } from '@/types/concert';

/**
 * Saved shows, split by whether they have happened yet.
 *
 * One screen serving both rather than two nearly identical files: the list, the
 * card, the empty state and the tap target are the same, and only the source
 * array and the copy differ. `?scope=past` selects which.
 *
 * Past shows are kept rather than deleted once the date passes. A saved concert
 * is a record of somewhere you went, and quietly erasing it the morning after
 * destroys the only history the app holds. They simply move out of the way.
 */
export default function SavedConcertsScreen() {
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const isPast = scope === 'past';

  const { session } = useAuth();
  const { savedConcerts, pastConcerts, isSaved, isSavePending, toggleSave } = useSavedConcerts(
    session?.user.id ?? null,
  );

  const concerts = isPast ? pastConcerts : savedConcerts;

  const handleSelect = useCallback((summary: ConcertSummary) => {
    router.push({ pathname: '/concert/[id]', params: { id: summary.id } });
  }, []);
  const handleToggleSave = useCallback(
    (concert: ConcertSummary) => toggleSave(concert),
    [toggleSave],
  );

  return (
    <SettingsDetailScreen
      title={isPast ? 'Past Events' : 'Saved Concerts'}
      subtitle={
        concerts.length === 0
          ? undefined
          : `${concerts.length} ${concerts.length === 1 ? 'show' : 'shows'}`
      }>
      <View style={styles.list}>
        {concerts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {isPast
              ? "Nothing here yet. Shows you saved move here once they've happened, so you keep a record of where you went."
              : 'Nothing saved yet. Tap the heart on any show to keep it here.'}
          </ThemedText>
        ) : (
          concerts.map((concert) => (
            <ConcertListCard
              key={concert.id}
              concert={concert}
              onPress={handleSelect}
              isSaved={isSaved(concert.id)}
              isSavePending={isSavePending(concert.id)}
              // Past shows keep the heart so a save can still be undone, but
              // nothing here is time-sensitive any more.
              onToggleSave={session ? handleToggleSave : undefined}
            />
          ))
        )}
      </View>
    </SettingsDetailScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three, paddingHorizontal: Spacing.four },
});
