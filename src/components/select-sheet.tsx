import { useState } from 'react';
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
  /**
   * A second level, revealed by tapping this row rather than listed beneath it.
   *
   * Boroughs were indented under their city in one flat list, which works at
   * six cities and stops working well before sixty: every city's sub-areas are
   * on screen at once whether or not you care about them, and New York alone
   * turned a six-row list into eleven. Drilling in keeps the top level one row
   * per city no matter how many exist.
   */
  children?: SelectOption[];
  /**
   * Row shown at the top of a drilled-in level to pick the parent itself —
   * "All of New York" rather than a specific borough. Without it, tapping into
   * a city would be a one-way trip into having to choose a sub-area.
   */
  selfLabel?: string;
};

/**
 * A second, independently-selected group in the same sheet.
 *
 * Distance is not another category — you want "21+" *and* "within 5 miles", not
 * one or the other — so it cannot be another row in a single-select list. It
 * also cannot be another pill: the row measured 332pt of a 361pt budget at
 * 393pt with four pills, and a fifth pushes it off-screen while horizontal
 * scrolling was ruled out deliberately.
 *
 * So the sheet grows a second section instead. Each section keeps its own
 * selection, which is the only shape that lets two independent filters share
 * one surface without pretending to be the same question.
 *
 * A section is one row that drills in, not its options listed inline. Inline
 * cost a row per option below a list that already filled the sheet: measured
 * at 393x852, the seven categories ran to the bottom edge and every distance
 * option sat past it, so the control was invisible until you thought to scroll
 * a sheet that gave no sign there was more. Collapsed, the whole sheet fits and
 * the row still shows its current value.
 */
export type SelectSection = {
  title: string;
  options: SelectOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Shown under the heading when the section needs a word of explanation. */
  note?: string;
};

type SelectSheetProps = {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Rendered below the main list, each with its own independent selection. */
  sections?: SelectSection[];
};

type SheetRowProps = {
  label: string;
  detail?: string;
  selected: boolean;
  /** Draws a chevron rather than a check — the row opens a list, not a choice. */
  opensList?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * One row, shared by the option list, the drilled-in sub-lists and the section
 * summaries. These were three near-identical copies before sections learned to
 * drill; a fourth was the point to stop copying.
 */
function SheetRow({
  label,
  detail,
  selected,
  opensList = false,
  accessibilityLabel,
  onPress,
}: SheetRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={opensList ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowLabel}>
        <ThemedText
          type={selected ? 'smallBold' : 'default'}
          style={selected ? { color: theme.accentText } : undefined}
          numberOfLines={1}>
          {label}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {/* A check as well as the colour. Selected state carried by hue alone
          fails for anyone who cannot separate those two reds, and it is the one
          state on this sheet that has to be unambiguous. A chevron instead when
          the row opens a list — the two mean opposite things and must not look
          alike. */}
      {opensList ? (
        <ThemedText allowFontScaling={false} style={[styles.check, { color: theme.textSecondary }]}>
          ›
        </ThemedText>
      ) : selected ? (
        <ThemedText allowFontScaling={false} style={[styles.check, { color: theme.accentText }]}>
          ✓
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

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
  sections,
}: SelectSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Which parent we have drilled into, or null at the top level. Held as the
  // option id rather than the option itself so it cannot go stale if the list
  // is rebuilt underneath — the id is looked up fresh on every render. Sections
  // drill by title for the same reason.
  //
  // Two ids rather than one tagged union: they are mutually exclusive by
  // construction (you can only tap one row), and every write below clears the
  // other, so the pair cannot represent a state the UI does not have.
  const [drilledId, setDrilledId] = useState<string | null>(null);
  const [drilledSectionTitle, setDrilledSectionTitle] = useState<string | null>(null);

  const drilled = drilledId ? (options.find((option) => option.id === drilledId) ?? null) : null;
  const drilledSection = drilledSectionTitle
    ? (sections?.find((section) => section.title === drilledSectionTitle) ?? null)
    : null;

  // Reset to the top level whenever the sheet is reopened, so it never comes
  // back showing the sub-list somebody backed out of last time. Compared during
  // render rather than in an effect, matching how the date sheet re-stages its
  // pending selection.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      if (drilledId) setDrilledId(null);
      if (drilledSectionTitle) setDrilledSectionTitle(null);
    }
  }

  const rows: SelectOption[] = drilled
    ? [
        ...(drilled.selfLabel ? [{ id: drilled.id, label: drilled.selfLabel }] : []),
        ...(drilled.children ?? []),
      ]
    : options;

  function goToTopLevel() {
    setDrilledId(null);
    setDrilledSectionTitle(null);
  }

  function close() {
    goToTopLevel();
    onClose();
  }

  const isDrilled = Boolean(drilled || drilledSection);
  const drilledLabel = drilled?.label ?? drilledSection?.title ?? '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      <ThemedView
        type="backgroundElement"
        style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          {/* Back replaces nothing at the top level — the title simply shifts to
              name where you are. A drilled-in sheet with no way back would trap
              someone who tapped the wrong city. */}
          {isDrilled ? (
            <Pressable
              onPress={goToTopLevel}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Back to ${title}`}
              style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}>
              <ThemedText allowFontScaling={false} style={styles.closeIcon}>
                ‹
              </ThemedText>
              <ThemedText type="subtitle">{drilledLabel}</ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="subtitle">{title}</ThemedText>
          )}
          <Pressable
            onPress={close}
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
          {drilledSection ? (
            <>
              {drilledSection.note ? (
                <View style={styles.sectionHeading}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {drilledSection.note}
                  </ThemedText>
                </View>
              ) : null}
              {drilledSection.options.map((option) => (
                <SheetRow
                  key={option.id}
                  label={option.label}
                  detail={option.detail}
                  selected={option.id === drilledSection.selectedId}
                  // Names the section too, so a screen reader hears "Distance,
                  // within 5 miles" rather than a bare "within 5 miles" with no
                  // idea which control it belongs to.
                  accessibilityLabel={`${drilledSection.title}, ${option.label}`}
                  onPress={() => {
                    drilledSection.onSelect(option.id);
                    close();
                  }}
                />
              ))}
            </>
          ) : (
            <>
              {rows.map((option) => {
                // Only drill in from the top level, so a sub-list cannot nest
                // further. Two levels is all the data has, and an unbounded
                // stack would need a breadcrumb this sheet has no room for.
                const canDrill = !drilled && Boolean(option.children?.length);
                return (
                  <SheetRow
                    key={option.id}
                    label={option.label}
                    detail={option.detail}
                    selected={option.id === selectedId}
                    opensList={canDrill}
                    accessibilityLabel={
                      canDrill
                        ? `${option.label}, ${option.children?.length} areas. Opens a list.`
                        : option.detail
                          ? `${option.label}, ${option.detail}`
                          : option.label
                    }
                    onPress={() => {
                      if (canDrill) {
                        setDrilledSectionTitle(null);
                        setDrilledId(option.id);
                        return;
                      }
                      onSelect(option.id);
                      close();
                    }}
                  />
                );
              })}

              {/* Only at the top level. A drilled-in sub-list is answering a
                  different question, and an unrelated section beneath it would
                  make the back button ambiguous about what it returns to. */}
              {!drilled &&
                sections?.map((section) => {
                  // The section's own value on the row's second line, so
                  // collapsing it does not hide what it is currently set to.
                  // Without this the row would be the one control on the sheet
                  // you have to open to find out whether it is doing anything.
                  const current = section.options.find(
                    (option) => option.id === section.selectedId,
                  );
                  return (
                    <SheetRow
                      key={section.title}
                      label={section.title}
                      detail={current?.label}
                      selected={false}
                      opensList
                      accessibilityLabel={
                        current
                          ? `${section.title}, ${current.label}. Opens a list.`
                          : `${section.title}. Opens a list.`
                      }
                      onPress={() => {
                        setDrilledId(null);
                        setDrilledSectionTitle(section.title);
                      }}
                    />
                  );
                })}
            </>
          )}
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
  // Space above separates the section note from the rows it introduces; the
  // label aligns with the rows rather than the sheet edge.
  sectionHeading: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
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
  rowLabel: { flex: 1, gap: Spacing.half },
  check: { fontSize: 16 },
  pressed: { opacity: 0.7 },
});
