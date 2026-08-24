import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, TextStyle, View } from 'react-native';

import { ConcertListCard } from '@/components/concert-list-card';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SkeletonCardRow } from '@/components/skeleton-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { distanceLabelFor } from '@/lib/geo';
import { searchConcerts, topSuggestions } from '@/lib/search-concerts';
import { CITIES, ConcertSummary } from '@/types/concert';

/**
 * Search, as its own tab.
 *
 * A tab rather than a field on the home screen because that is what music apps
 * do — Spotify's bottom bar is Home / Search / Library — and because the two
 * jobs are genuinely different. Home answers "what is on", which is a browsing
 * question the filters and the night strip already serve. Search answers "is
 * this specific act playing", which is a question someone arrives with, and
 * burying it in a header makes it a second-class way in.
 *
 * The Ask feature is *not* wired in here yet, deliberately. Its Edge Function
 * has never been deployed, and a tab containing a control that can only error
 * is exactly why the Ask tab was removed in the first place. The layout leaves
 * room for it to become a mode within this screen once it actually runs.
 */
export default function SearchScreen() {
  const [city, setCity] = useState(CITIES[0]);
  const [query, setQuery] = useState('');
  const theme = useTheme();

  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);

  const { concerts, isLoading, refresh } = useEdmConcerts(city);
  const { isSaved, isSavePending, toggleSave } = useSavedConcerts(session?.user.id ?? null);
  const { coords: userLocation } = useUserLocation();

  const results = useMemo(() => searchConcerts(concerts, query), [concerts, query]);
  const suggestions = useMemo(() => topSuggestions(concerts), [concerts]);

  const handleSelectConcert = useCallback((summary: ConcertSummary) => {
    router.push({ pathname: '/concert/[id]', params: { id: summary.id } });
  }, []);
  const handleToggleSave = useCallback(
    (concert: ConcertSummary) => toggleSave(concert),
    [toggleSave],
  );

  const trimmed = query.trim();

  return (
    <ScreenScaffold title="Search" onRefresh={refresh}>
      <View style={styles.fieldRow}>
        <ThemedView type="backgroundElement" style={styles.field}>
          <ThemedText allowFontScaling={false} style={[styles.glyph, { color: theme.textSecondary }]}>
            ⌕
          </ThemedText>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Artists, venues in ${city.label}`}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, noFocusRing, { color: theme.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            // No debounce and no network call: this filters a list the app
            // already holds, so results land on the keystroke. A request per
            // keystroke would be slower, spend quota, and fail offline.
            accessibilityLabel="Search artists and venues"
            clearButtonMode="while-editing"
          />
          {/* Android and web have no native clear affordance, and a field you
              cannot empty in one tap is a small trap on a screen whose whole
              job is repeated queries. */}
          {trimmed.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText
                allowFontScaling={false}
                style={[styles.glyph, { color: theme.textSecondary }]}>
                ✕
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      </View>

      {isLoading && concerts.length === 0 && (
        <ThemedView style={styles.list}>
          <SkeletonCardRow />
        </ThemedView>
      )}

      {/* Nothing typed: offer the busiest rooms and acts rather than an empty
          screen. A blank field asks a question most people cannot answer —
          nobody opening this already knows who is in town this week. */}
      {!trimmed && !isLoading && suggestions.length > 0 && (
        <ThemedView style={styles.section}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Busy this week
          </ThemedText>
          <View style={styles.chips}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={`${suggestion.kind}:${suggestion.name}`}
                onPress={() => setQuery(suggestion.name)}
                accessibilityRole="button"
                accessibilityLabel={`Search ${suggestion.name}, ${suggestion.count} ${
                  suggestion.count === 1 ? 'date' : 'dates'
                }`}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.chip}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.chipLabel}>
                    {suggestion.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.chipCount}>
                    {suggestion.count}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      )}

      {trimmed.length > 0 && (
        <ThemedView style={styles.section}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            {results.length === 0
              ? 'No matches'
              : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
          </ThemedText>

          {/* Says which city was searched. Results are scoped to the loaded
              city, so "no matches" without that context reads as "this act is
              not touring" when it may simply be playing elsewhere. */}
          {results.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing matching “{trimmed}” in {city.label}. Try a venue name, or switch city on the
              Home tab.
            </ThemedText>
          )}
        </ThemedView>
      )}

      <ThemedView style={styles.list}>
        {results.map((concert) => (
          <ConcertListCard
            key={concert.id}
            concert={concert}
            onPress={handleSelectConcert}
            isSaved={isSaved(concert.id)}
            isSavePending={isSavePending(concert.id)}
            onToggleSave={session ? handleToggleSave : undefined}
            distanceLabel={distanceLabelFor(userLocation, concert)}
          />
        ))}
      </ThemedView>
    </ScreenScaffold>
  );
}

/**
 * React Native Web maps TextInput onto a real <input>, which draws a focus
 * ring nothing else in this app uses. outlineStyle is a genuine web style but
 * absent from React Native TextStyle, so the cast is the honest way to say
 * "this is web-only" rather than widening the whole stylesheet.
 */
const noFocusRing =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  fieldRow: { paddingBottom: Spacing.one },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    // Comfortably past the 44pt minimum: this is the one control on the screen
    // that everything else depends on.
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: Fonts.size.base,
    // Height rather than padding, so the text sits on the same optical line as
    // the glyphs either side of it regardless of platform default padding.
    height: 48,
  },
  // Off-scale: single glyphs optically centred against the field's own height.
  glyph: { fontSize: 18, lineHeight: 22 },
  section: { gap: Spacing.two, paddingBottom: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    maxWidth: 260,
  },
  chipLabel: { flexShrink: 1 },
  chipCount: { fontSize: Fonts.size.xs },
  list: { gap: Spacing.three },
  pressed: { opacity: 0.7 },
});
