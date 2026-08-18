import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LocationPermissionPromptProps = {
  visible: boolean;
  onAllow: () => void;
  onDeny: () => void;
};

// The app's own soft-ask, shown once before the real OS permission dialog —
// standard practice so a reflexive tap on the (much harder to reverse) OS
// dialog doesn't permanently deny access. See use-user-location.ts for the
// "only once per install" persistence.
export function LocationPermissionPrompt({ visible, onAllow, onDeny }: LocationPermissionPromptProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDeny}>
      <Pressable style={styles.backdrop} onPress={onDeny} accessibilityLabel="Dismiss" />
      <ThemedView
        type="backgroundElement"
        style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.grabber} />
        <View style={styles.content}>
          <ThemedText type="subtitle">See how far shows are?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Music Map can use your location to show the distance to each concert and mark where you
            are on the map. This stays on your device — nothing is sent anywhere.
          </ThemedText>
        </View>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={onDeny}
            style={({ pressed }) => [styles.denyButton, { borderColor: theme.border }, pressed && styles.pressed]}>
            <ThemedText type="smallBold">Not Now</ThemedText>
          </Pressable>
          <Pressable
            onPress={onAllow}
            style={({ pressed }) => [styles.allowButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
              Turn On Location
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
    gap: Spacing.four,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.grabber,
    marginTop: Spacing.two,
  },
  content: {
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  denyButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  allowButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
});
