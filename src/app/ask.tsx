import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ConcertDetailSheet } from '@/components/concert-detail-sheet';
import { ConcertListCard } from '@/components/concert-list-card';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAsk } from '@/hooks/use-ask';
import { useAuth } from '@/hooks/use-auth';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { getDirectionsUrl } from '@/lib/directions';
import { distanceLabelFor } from '@/lib/geo';
import { CITIES, Concert } from '@/types/concert';

const EXAMPLES = [
  'Something like Fred again.. this weekend',
  'A loud warehouse night in Brooklyn',
  'Somewhere I can actually hear my friends talk',
];

export default function AskScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  const [city, setCity] = useState(CITIES[0]);
  useApplyDefaultCity(profile, setCity);
  const { concerts, isLoading: isLoadingConcerts } = useEdmConcerts(city);
  const { exchanges, ask, isLoading, error, lastUsage } = useAsk(concerts);
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);
  const { coords: userLocation } = useUserLocation();
  const [draft, setDraft] = useState('');
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);

  async function submit(question: string) {
    setDraft('');
    await ask(question);
  }

  // The Edge Function requires a signed-in user — without that it would be an
  // open, billable endpoint anyone could point a script at.
  if (!session) {
    return (
      <ScreenScaffold title="Ask" subtitle="Find shows by describing what you're after.">
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Sign in to use Ask</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Ask needs an account so usage can be tied to you. You can still browse every show
            without one — head to Settings to sign in.
          </ThemedText>
        </ThemedView>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title="Ask" subtitle="Find shows by describing what you're after.">
      <View style={styles.composer}>
        <ThemedView type="backgroundElement" style={styles.inputWrapper}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="What are you in the mood for?"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={500}
            editable={!isLoading}
            onSubmitEditing={() => submit(draft)}
            style={[styles.input, { color: theme.text }]}
          />
        </ThemedView>
        <Pressable
          onPress={() => submit(draft)}
          disabled={!draft.trim() || isLoading || isLoadingConcerts}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
            (!draft.trim() || isLoading || isLoadingConcerts) && styles.disabled,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
            {isLoading ? 'Thinking…' : 'Ask'}
          </ThemedText>
        </Pressable>
      </View>

      {exchanges.length === 0 && !isLoading && (
        <View style={styles.examples}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Try asking
          </ThemedText>
          {EXAMPLES.map((example) => (
            <Pressable
              key={example}
              onPress={() => submit(example)}
              disabled={isLoadingConcerts}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.exampleRow}>
                <ThemedText type="small" style={{ color: theme.accentText }}>
                  {example}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </View>
      )}

      {error && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small">{error}</ThemedText>
        </ThemedView>
      )}

      {exchanges.map((exchange) => (
        <View key={exchange.id} style={styles.exchange}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            You asked
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {exchange.question}
          </ThemedText>
          <ThemedText type="default" style={styles.reply}>
            {exchange.reply}
          </ThemedText>
          {exchange.concerts.map((concert) => (
            <ConcertListCard
              key={concert.id}
              concert={concert}
              onPress={() => setSelectedConcert(concert)}
              isSaved={isSaved(concert.id)}
              isSavePending={isSavePending(concert.id)}
              onToggleSave={() => toggleSave(concert)}
              distanceLabel={distanceLabelFor(userLocation, concert)}
            />
          ))}
        </View>
      ))}

      {isLoading && (
        <ThemedView style={styles.loading}>
          <ActivityIndicator color={theme.accentText} />
        </ThemedView>
      )}

      {/* Surfaced deliberately: this feature bills per question, so the cost of
          the last one is always visible rather than discovered on an invoice. */}
      {lastUsage && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.usage}>
          Last question cost ${lastUsage.costUsd.toFixed(4)} · {lastUsage.requestsToday} of{' '}
          {lastUsage.dailyLimit} today
        </ThemedText>
      )}

      <ConcertDetailSheet
        concert={selectedConcert}
        onClose={() => setSelectedConcert(null)}
        isSaved={selectedConcert ? isSaved(selectedConcert.id) : undefined}
        isSavePending={selectedConcert ? isSavePending(selectedConcert.id) : undefined}
        onToggleSave={selectedConcert ? () => toggleSave(selectedConcert) : undefined}
        distanceLabel={selectedConcert ? distanceLabelFor(userLocation, selectedConcert) : undefined}
        directionsUrl={selectedConcert ? getDirectionsUrl(selectedConcert) : undefined}
      />
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
  composer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  inputWrapper: {
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: Spacing.three,
    minHeight: 68,
  },
  sendButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  examples: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  exampleRow: {
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  exchange: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  reply: {
    lineHeight: 24,
  },
  loading: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  usage: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
});
