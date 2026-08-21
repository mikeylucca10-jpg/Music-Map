import { StyleSheet, Switch, View } from 'react-native';

import { SettingsDetailScreen } from '@/components/settings-detail-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useFollows } from '@/hooks/use-follows';
import { useNotificationPrefs } from '@/hooks/use-notification-prefs';
import { useTheme } from '@/hooks/use-theme';

/**
 * Which alerts a person wants, on its own screen.
 *
 * Grouped by topic rather than by delivery mechanism, because that is how
 * people think about notifications: "tell me about new shows" is a decision
 * somebody can make, where "enable push" is not. Being able to switch off one
 * kind is what stops people switching off every kind, and that is the single
 * biggest lever on whether notifications survive past the first month.
 */
export default function AlertsSettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { prefs, setPref, error } = useNotificationPrefs(userId);
  const { follows } = useFollows(userId);

  return (
    <SettingsDetailScreen
      title="Alerts"
      subtitle="At most one a week, and never for anything you don't follow.">
      <View style={styles.list}>
        <AlertToggle
          label="New shows"
          detail="When something you follow is announced."
          value={prefs.justAnnounced}
          onChange={(value) => setPref('justAnnounced', value)}
        />
        <AlertToggle
          label="Doors tomorrow"
          detail="A reminder the day before a show you saved."
          value={prefs.doorsTomorrow}
          onChange={(value) => setPref('doorsTomorrow', value)}
        />
        <AlertToggle
          label="Weekly roundup"
          detail="What's on this week in your city."
          value={prefs.weeklyDigest}
          onChange={(value) => setPref('weeklyDigest', value)}
        />
      </View>

      {error ? (
        <ThemedText type="small" style={[styles.note, { color: theme.accentText }]}>
          {error}
        </ThemedText>
      ) : null}

      {/* Says plainly why the switches above may never fire. Someone who has
          turned everything on and hears nothing should be told the reason
          rather than left assuming the feature is broken. */}
      {follows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          You&apos;re not following anything yet, so there&apos;s nothing to alert you about. Follow
          an artist or a venue from any show and these start working.
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Based on the {follows.length} {follows.length === 1 ? 'thing' : 'things'} you follow.
        </ThemedText>
      )}
    </SettingsDetailScreen>
  );
}

function AlertToggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={styles.rowLabel}>
        <ThemedText type="default">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        // The label carries the meaning; the switch alone would announce only
        // "on" or "off" with no idea what it governs.
        accessibilityLabel={label}
        trackColor={{ false: theme.border, true: theme.accent }}
        thumbColor={theme.text}
      />
    </ThemedView>
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
  note: { paddingHorizontal: Spacing.four },
});
