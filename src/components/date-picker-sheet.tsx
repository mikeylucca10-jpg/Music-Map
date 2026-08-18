import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dateKeyFor, getNycDateKey } from '@/lib/format-date';

type DatePickerSheetProps = {
  visible: boolean;
  selectedDateKey: string | null;
  onApply: (dateKey: string | null) => void;
  onClose: () => void;
  /** Quick-select shortcuts shown between the grid and Reset/Apply — omit
   * either to hide the row (e.g. if the host screen has no week concept).
   * onSelectNextWeek is relative (steps one further week each tap, same as
   * the filter bar's '>' arrow) so repeat taps keep paging forward instead
   * of landing on a fixed week; onSelectThisWeek is an absolute reset. */
  onSelectThisWeek?: () => void;
  onSelectNextWeek?: () => void;
  /** Current week position ("This Week"/"Next Week"/a date range), shown
   * next to the quick-select buttons as feedback since the modal covers the
   * filter bar's own week-nav row while open. */
  weekLabel?: string;
};

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const MAX_MONTHS_AHEAD = 12;

function monthIndex(year: number, month: number) {
  return year * 12 + month;
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month: month - 1, day };
}

// One cell per day of the grid, with `null` padding cells before the 1st so
// the first real day lands in its correct SUN–SAT column.
function getCalendarCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
}

export function DatePickerSheet({
  visible,
  selectedDateKey,
  onApply,
  onClose,
  onSelectThisWeek,
  onSelectNextWeek,
  weekLabel,
}: DatePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const todayKey = getNycDateKey(new Date());
  const today = parseDateKey(todayKey);

  const [pendingDateKey, setPendingDateKey] = useState(selectedDateKey);
  const [viewYear, setViewYear] = useState(() => (selectedDateKey ? parseDateKey(selectedDateKey).year : today.year));
  const [viewMonth, setViewMonth] = useState(() => (selectedDateKey ? parseDateKey(selectedDateKey).month : today.month));

  // Re-stage from the applied selection every time the sheet opens, so a
  // cancelled edit doesn't leak into the next open. Adjusts during render
  // (not a useEffect) — same pattern as the city-reset in
  // use-concerts-filters.ts, so it doesn't need a set-state-in-effect
  // eslint-disable.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      const base = selectedDateKey ? parseDateKey(selectedDateKey) : today;
      setPendingDateKey(selectedDateKey);
      setViewYear(base.year);
      setViewMonth(base.month);
    }
  }

  const canGoPrev = monthIndex(viewYear, viewMonth) > monthIndex(today.year, today.month);
  const canGoNext = monthIndex(viewYear, viewMonth) < monthIndex(today.year, today.month) + MAX_MONTHS_AHEAD;

  function goToMonth(delta: number) {
    const total = monthIndex(viewYear, viewMonth) + delta;
    setViewYear(Math.floor(total / 12));
    setViewMonth(((total % 12) + 12) % 12);
  }

  function handleResetToToday() {
    setPendingDateKey(todayKey);
    setViewYear(today.year);
    setViewMonth(today.month);
  }

  function handleApply() {
    onApply(pendingDateKey);
    onClose();
  }

  // Quick-select shortcuts: these represent a whole week, not one specific
  // day, so they clear any exact-date selection (the week window only takes
  // effect once dateKey is null — see isWithinActiveWindow in
  // use-concerts-filters.ts) and apply immediately rather than staging.
  // Deliberately don't close — onSelectNextWeek is relative, so tapping it
  // repeatedly should keep paging forward (This Week -> Next Week -> the
  // week after, etc.) without having to reopen the sheet each time.
  function handleSelectThisWeek() {
    onApply(null);
    onSelectThisWeek?.();
  }
  function handleSelectNextWeek() {
    onApply(null);
    onSelectNextWeek?.();
  }

  const cells = getCalendarCells(viewYear, viewMonth);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView
        type="backgroundElement"
        style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Select Date
          </ThemedText>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <ThemedText style={styles.closeIcon}>✕</ThemedText>
          </Pressable>
        </View>

        <View style={styles.monthRow}>
          {/* "‹" alone reads as a punctuation character to a screen reader, so
              each arrow states the month it moves to rather than a bare
              "previous"/"next". */}
          <Pressable
            onPress={() => goToMonth(-1)}
            disabled={!canGoPrev}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoPrev }}
            accessibilityLabel={`Previous month, ${MONTH_LABEL_FORMATTER.format(new Date(viewYear, viewMonth - 1, 1))}`}>
            <ThemedText
              type="subtitle"
              themeColor={canGoPrev ? 'text' : 'textSecondary'}
              style={!canGoPrev && styles.disabled}>
              ‹
            </ThemedText>
          </Pressable>
          <ThemedText type="subtitle">{MONTH_LABEL_FORMATTER.format(new Date(viewYear, viewMonth, 1))}</ThemedText>
          <Pressable
            onPress={() => goToMonth(1)}
            disabled={!canGoNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoNext }}
            accessibilityLabel={`Next month, ${MONTH_LABEL_FORMATTER.format(new Date(viewYear, viewMonth + 1, 1))}`}>
            <ThemedText
              type="subtitle"
              themeColor={canGoNext ? 'text' : 'textSecondary'}
              style={!canGoNext && styles.disabled}>
              ›
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label) => (
            <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.weekdayCell}>
              {label}
            </ThemedText>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {cells.map((day, index) => {
            if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;

            const key = dateKeyFor(viewYear, viewMonth, day);
            const isPast = key < todayKey;
            const isToday = key === todayKey;
            const isSelected = key === pendingDateKey;

            return (
              <Pressable
                key={key}
                disabled={isPast}
                onPress={() => setPendingDateKey(isSelected ? null : key)}
                style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: theme.accent },
                    isToday && !isSelected && { borderWidth: 1, borderColor: theme.accentText },
                  ]}>
                  <ThemedText
                    type={isSelected ? 'smallBold' : 'small'}
                    themeColor={isPast ? 'textSecondary' : 'text'}
                    style={[isSelected && { color: theme.accentInk }, isPast && styles.pastText]}>
                    {day}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {onSelectThisWeek && onSelectNextWeek && (
          <View style={styles.quickSection}>
            <View style={styles.quickRow}>
              <Pressable
                onPress={handleSelectThisWeek}
                style={({ pressed }) => [styles.quickButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText type="smallBold">This Week</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSelectNextWeek}
                style={({ pressed }) => [styles.quickButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText type="smallBold">Next Week ›</ThemedText>
              </Pressable>
            </View>
            {weekLabel && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.quickLabel}>
                Showing: {weekLabel}
              </ThemedText>
            )}
          </View>
        )}

        <View style={styles.footerRow}>
          <Pressable
            onPress={handleResetToToday}
            style={({ pressed }) => [
              styles.resetButton,
              { borderColor: theme.accentText },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              Reset to Today
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleApply}
            style={({ pressed }) => [styles.applyButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
              Apply
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
  closeIcon: {
    fontSize: 18,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastText: {
    opacity: 0.4,
  },
  quickSection: {
    gap: Spacing.one,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  quickLabel: {
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  resetButton: {
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  applyButton: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
