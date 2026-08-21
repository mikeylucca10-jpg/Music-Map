import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsDetailScreen } from '@/components/settings-detail-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { CITIES } from '@/types/concert';

/**
 * Which city the app opens on.
 *
 * A preference rather than a filter, which is the reason it lives in Settings
 * and not on the filter bar: the pill at the top of Home changes what you are
 * looking at right now, this changes where you start next time.
 *
 * It is also the only location the server ever sees. Quiet hours for
 * notifications are derived from it, because real coordinates are deliberately
 * never sent anywhere — the privacy policy says so and that has to stay true.
 */
export default function CitySettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { profile, updateProfile } = useProfile(session?.user.id ?? null);
  const selectedId = profile?.defaultCity ?? CITIES[0].id;

  return (
    <SettingsDetailScreen
      title="Default City"
      subtitle="Where the app opens, and the clock your alerts respect.">
      <View style={styles.list}>
        {CITIES.map((city) => {
          const selected = city.id === selectedId;
          return (
            <Pressable
              key={city.id}
              onPress={() => updateProfile({ defaultCity: city.id })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={city.label}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type={selected ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.row}>
                <View style={styles.rowLabel}>
                  <ThemedText
                    type={selected ? 'smallBold' : 'default'}
                    style={selected ? { color: theme.accentText } : undefined}>
                    {city.label}
                  </ThemedText>
                  {/* Only New York has been checked against real listings. Saying
                      so is better than letting someone switch to Miami and quietly
                      wonder why it feels thin. */}
                  {city.id !== 'nyc' ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Listings not yet verified
                    </ThemedText>
                  ) : null}
                </View>
                {/* A tick as well as the colour: state carried by hue alone fails
                    for anyone who cannot separate the two reds. */}
                {selected ? (
                  <ThemedText
                    allowFontScaling={false}
                    style={[styles.check, { color: theme.accentText }]}>
                    ✓
                  </ThemedText>
                ) : null}
              </ThemedView>
            </Pressable>
          );
        })}
      </View>
    </SettingsDetailScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two, paddingHorizontal: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
  },
  rowLabel: { flex: 1, gap: Spacing.half },
  // Off-scale: one glyph optically centred in the row.
  check: { fontSize: 17, lineHeight: 19 },
  pressed: { opacity: 0.7 },
});
