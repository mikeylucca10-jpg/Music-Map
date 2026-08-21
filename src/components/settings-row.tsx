import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SettingsRowProps = {
  label: string;
  /**
   * The current answer, shown on the right — "6 following", "New York".
   *
   * This is what makes a menu of rows better than the long scroll it replaces
   * rather than merely tidier. A row that only says "Following" hides its own
   * state behind a tap, so the screen answers fewer questions than before;
   * "Following · 6" answers the common one without opening anything.
   */
  value?: string;
  onPress: () => void;
  /** Dimmed and inert, for a row with nothing behind it yet. */
  disabled?: boolean;
  /** Draws the divider above this row — omitted on the first of a group. */
  showDivider?: boolean;
};

/**
 * One tappable line in Settings.
 *
 * Settings used to render every section's full contents inline, so the screen
 * was a long scroll of toggles, lists and forms with no overview. Rows that
 * open their own screen mean the top level fits on one screen and reads as a
 * table of contents, which is how a settings screen is actually used: people
 * arrive knowing what they came to change.
 */
export function SettingsRow({
  label,
  value,
  onPress,
  disabled,
  showDivider = true,
}: SettingsRowProps) {
  const theme = useTheme();

  return (
    <>
      {showDivider && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        // The value belongs in the label rather than being read separately, so
        // a screen reader announces "Following, 6, opens a list" as one thought
        // instead of three fragments.
        accessibilityLabel={value ? `${label}, ${value}` : label}
        accessibilityHint="Opens a screen"
        style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed]}>
        <ThemedText type="default" style={disabled ? { color: theme.textSecondary } : undefined}>
          {label}
        </ThemedText>
        <View style={styles.right}>
          {value ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {value}
            </ThemedText>
          ) : null}
          {/* A chevron, not an arrow: this pushes a screen rather than leaving
              the app, and the two should not look alike. */}
          <ThemedText
            allowFontScaling={false}
            style={[styles.chevron, { color: theme.textSecondary }]}>
            ›
          </ThemedText>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    // Taller than the 44pt minimum. These are the primary targets on the
    // screen and they are hit while walking.
    minHeight: MinTouchTarget + 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Lets a long value ellipsize rather than pushing the chevron off-screen.
    flexShrink: 1,
  },
  // Inset to the label's left edge rather than full-bleed, so the rows read as
  // one grouped list instead of separate bands.
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.four,
  },
  // Off-scale: a single glyph optically centred against the row's text.
  chevron: { fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.6 },
});
