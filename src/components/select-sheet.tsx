import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption = {
  id: string;
  label: string;
  /** Secondary line — a count, a hint, whatever the row needs to say. */
  detail?: string;
  /** Indents the row under the option above it, for boroughs under a city. */
  nested?: boolean;
};

type SelectSheetProps = {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
};

/**
 * One-of-many selection, as a bottom sheet rather than a dropdown.
 *
 * The city and category controls were absolutely-positioned dropdown menus, and
 * both had outgrown the pattern. Dropdowns stop working on mobile past about
 * five options, and the city menu carries eleven rows once New York's boroughs
 * are nested under it — enough that it needed a maxHeight and an inner
 * ScrollView, which is the documented worst case: a scrolling list inside a
 * small floating panel, positioned at the top of the screen where a thumb
 * cannot comfortably reach, with a finger covering the options while choosing.
 *
 * A sheet fixes all of that at once. It sits under the thumb, it has room to
 * breathe, it grows with its content instead of being clipped, and it matches
 * the date picker — which was already a sheet, and is the control on this
 * screen that reads as finished.
 *
 * It also removes a whole class of bug rather than working around it. React
 * Native Web makes every View its own stacking context, and the dropdowns had
 * already been fixed twice for z-index fights and once needed a full-screen
 * backdrop bolted on to close them. A Modal has none of those problems: it
 * renders above everything by construction and dismisses on its own backdrop.
 */
export function SelectSheet({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: SelectSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView
        type="backgroundElement"
        style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText allowFontScaling={false} style={styles.closeIcon}>
              ✕
            </ThemedText>
          </Pressable>
        </View>

        {/* Caps at 60% of the screen so a long list scrolls inside the sheet
            instead of pushing the sheet past the top of the display, while a
            short one still sits low and close to the thumb. */}
        <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const selected = option.id === selectedId;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  onSelect(option.id);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  option.detail ? `${option.label}, ${option.detail}` : option.label
                }
                style={({ pressed }) => [
                  styles.row,
                  option.nested && styles.rowNested,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.rowLabel}>
                  <ThemedText
                    type={selected ? 'smallBold' : 'default'}
                    style={selected ? { color: theme.accentText } : undefined}
                    numberOfLines={1}>
                    {option.label}
                  </ThemedText>
                  {option.detail ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {option.detail}
                    </ThemedText>
                  ) : null}
                </View>
                {/* A check as well as the colour. Selected state carried by hue
                    alone fails for anyone who cannot separate those two reds,
                    and it is the one state on this sheet that has to be
                    unambiguous. */}
                {selected ? (
                  <ThemedText
                    allowFontScaling={false}
                    style={[styles.check, { color: theme.accentText }]}>
                    ✓
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
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
    gap: Spacing.three,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.grabber,
    marginTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeIcon: { fontSize: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    // Comfortably past the 44pt minimum. These rows are the entire reason to
    // move off a dropdown, where they were roughly half this tall.
    minHeight: MinTouchTarget + 8,
    paddingVertical: Spacing.two,
  },
  // Boroughs sit under the city they belong to, so the relationship is legible
  // without a second screen or a separate control.
  rowNested: { paddingLeft: Spacing.four },
  rowLabel: { flex: 1, gap: Spacing.half },
  check: { fontSize: 16 },
  pressed: { opacity: 0.7 },
});
