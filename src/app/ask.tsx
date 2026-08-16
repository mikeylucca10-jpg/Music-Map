import { StyleSheet } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';

// Placeholder. The real feature needs a Supabase Edge Function to hold the
// LLM API key server-side — an EXPO_PUBLIC_ key would ship in the client
// bundle, and unlike the Ticketmaster key an LLM key is directly billable.
// Deliberately states plainly that it isn't built rather than faking a chat
// UI that does nothing.
export default function AskScreen() {
  return (
    <ScreenScaffold title="Ask" subtitle="Find shows by describing what you're after.">
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Not built yet</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          The plan for this tab: describe what you feel like — an artist you love, a sound, a night
          out — and get back real shows from the listings that match.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          It will only ever suggest concerts that actually exist in the current listings, never
          invented ones.
        </ThemedText>
      </ThemedView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    borderRadius: Radius.card,
    padding: Spacing.four,
  },
  body: {
    lineHeight: 21,
  },
});
