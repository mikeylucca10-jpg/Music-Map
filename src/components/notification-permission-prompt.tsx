import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NotificationPermissionPromptProps = {
  visible: boolean;
  onAllow: () => void;
  onDeny: () => void;
  /**
   * Something the viewer actually follows, used in the preview.
   *
   * Passing a real name is the whole point — a preview reading "Artist Name"
   * demonstrates a feature, while one reading the act they followed ten seconds
   * ago demonstrates *their* feature. Falls back only when nothing is followed.
   */
  sampleName?: string;
};

/**
 * The app's own ask, shown before the OS dialog ever appears.
 *
 * The OS prompt is one-shot and effectively permanent: dismissed reflexively,
 * it cannot be shown again and the person has to find the app in system
 * settings to undo it. So this goes first, and the native prompt is only fired
 * on "Turn On Alerts". Declining here costs nothing and can be asked again
 * later, which is exactly why asking here first raises acceptance so much:
 * soft-asks lift opt-in 30-50%, and iOS baseline opt-in is only about half.
 *
 * Three things carry that, all of them findings rather than taste:
 *
 *  1. It shows what the notification actually looks like, with a real name in
 *     it. The strongest permission screens preview the message rather than
 *     describe it, because "we'll tell you when they announce" is a claim while
 *     a rendered notification is evidence.
 *  2. It states the frequency, unprompted. Frequency without personalisation is
 *     the most-cited reason people kill notifications for good -- ahead of
 *     irrelevance -- so "about once a week" answers the actual objection.
 *  3. "Not now" is a real, equally-weighted option, not a greyed-out afterthought.
 *
 * Shown after following something rather than at launch: the ask only makes
 * sense once the person has done the thing the notification is about.
 */
export function NotificationPermissionPrompt({
  visible,
  onAllow,
  onDeny,
  sampleName,
}: NotificationPermissionPromptProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const previewBody = sampleName
    ? `${sampleName} just announced a show in New York.`
    : 'An act you follow just announced a show in New York.';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDeny}>
      <Pressable style={styles.backdrop} onPress={onDeny} accessibilityLabel="Dismiss" />
      <ThemedView
        type="backgroundElement"
        style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.grabber} />

        <View style={styles.content}>
          <ThemedText type="subtitle">Know first, not last</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tickets for the shows worth going to sell out before most people hear about them. Turn
            on alerts and we&apos;ll tell you the day something you follow is announced.
          </ThemedText>
        </View>

        {/* A rendered notification rather than a description of one. Deliberately
            not pretending to be the system's own chrome -- a priming screen that
            imitates the OS dialog is a dark pattern, and this reads clearly as
            the app showing an example. */}
        <View
          style={[styles.preview, { backgroundColor: theme.surfaceOverlay }]}
          accessible
          accessibilityLabel={`Example notification: Music Map. ${previewBody}`}>
          <View style={[styles.previewIcon, { backgroundColor: theme.accent }]}>
            <ThemedText
              allowFontScaling={false}
              style={[styles.previewIconGlyph, { color: theme.accentInk }]}>
              ♪
            </ThemedText>
          </View>
          <View style={styles.previewBody}>
            <View style={styles.previewHeader}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Music Map
              </ThemedText>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                now
              </ThemedText>
            </View>
            <ThemedText type="smallBold" numberOfLines={2}>
              {previewBody}
            </ThemedText>
          </View>
        </View>

        {/* Answers the objection before it is raised. The number is a promise the
            server side actually enforces -- see the one-per-week cap in
            notification_prefs.last_notified_at -- not a reassuring phrase. */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.frequency}>
          About once a week at most. Never for anything you don&apos;t follow, and you can pick
          exactly which alerts you get in Settings.
        </ThemedText>

        <View style={styles.buttonRow}>
          <Pressable
            onPress={onDeny}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={({ pressed }) => [
              styles.denyButton,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">Not Now</ThemedText>
          </Pressable>
          <Pressable
            onPress={onAllow}
            accessibilityRole="button"
            accessibilityLabel="Turn on alerts"
            style={({ pressed }) => [
              styles.allowButton,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
              Turn On Alerts
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.dark.backdrop,
  },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.grabber,
  },
  content: { gap: Spacing.two },
  preview: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
  },
  previewIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Off-scale: one glyph optically centred in a fixed square, where the line
  // height is doing centring rather than typographic work.
  previewIconGlyph: { fontSize: 20, lineHeight: 24 },
  previewBody: { flex: 1, gap: Spacing.half },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  frequency: { fontSize: Fonts.size.xs },
  buttonRow: { flexDirection: 'row', gap: Spacing.two },
  denyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  allowButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  pressed: { opacity: 0.75 },
});
