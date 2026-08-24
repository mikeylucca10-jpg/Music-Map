import { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type WeekNight = {
  dateKey: string;
  date: Date;
  count: number;
  isToday: boolean;
};

type NightDensityStripProps = {
  nights: WeekNight[];
  selectedDateKey: string | null;
  onSelectDateKey: (dateKey: string | null) => void;
  weekLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  canGoPrevWeek: boolean;
  canGoNextWeek: boolean;
};

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Tall enough to read as a bar chart, short enough not to crowd the list. */
const BAR_MAX_HEIGHT = 34;
/**
 * Empty nights still draw a stub. A night with nothing on is information —
 * collapsing it to zero height would make it read as missing data instead.
 */
const BAR_MIN_HEIGHT = 3;

/** Horizontal travel before a drag counts as a week page rather than a tap. */
const SWIPE_THRESHOLD = 48;

/**
 * Seven bars, one per night of the visible week, sized by how many shows are on.
 *
 * This replaces a "‹ This Week ›" arrow row. The arrows could page a week but
 * never said what was in one, so the single most useful fact about a week —
 * which nights actually have anything on — stayed invisible until you paged
 * onto it. Tap a bar to filter to that night, swipe or use the chevrons to page
 * weeks.
 *
 * No animation here on purpose: bars re-measuring on every filter change would
 * be motion carrying no information, and this sits directly above a list that
 * is already re-rendering.
 */
export function NightDensityStrip({
  nights,
  selectedDateKey,
  onSelectDateKey,
  weekLabel,
  onPrevWeek,
  onNextWeek,
  canGoPrevWeek,
  canGoNextWeek,
}: NightDensityStripProps) {
  const theme = useTheme();

  const busiest = useMemo(() => Math.max(1, ...nights.map((night) => night.count)), [nights]);

  // Rebuilt each render rather than memoized. PanResponder.create just returns
  // an object of handler functions, so this is cheap, and the closures capture
  // the current callbacks directly — a memo would need a ref to stay fresh,
  // and reading a ref during render is exactly what it looks like.
  const panResponder = PanResponder.create({
    // Claim the gesture only once it is clearly horizontal, so a vertical
    // scroll that happens to start on the strip still scrolls the list.
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5 && Math.abs(gesture.dx) > 12,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx <= -SWIPE_THRESHOLD && canGoNextWeek) onNextWeek();
      else if (gesture.dx >= SWIPE_THRESHOLD && canGoPrevWeek) onPrevWeek();
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceRaised }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onPrevWeek}
          disabled={!canGoPrevWeek}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          accessibilityState={{ disabled: !canGoPrevWeek }}
          style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}>
          <ThemedText
            type="smallBold"
            themeColor={canGoPrevWeek ? 'text' : 'textSecondary'}
            style={!canGoPrevWeek && styles.disabled}>
            ‹
          </ThemedText>
        </Pressable>

        <ThemedText type="eyebrow" themeColor="textSecondary">
          {weekLabel}
        </ThemedText>

        <Pressable
          onPress={onNextWeek}
          disabled={!canGoNextWeek}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next week"
          accessibilityState={{ disabled: !canGoNextWeek }}
          style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}>
          <ThemedText
            type="smallBold"
            themeColor={canGoNextWeek ? 'text' : 'textSecondary'}
            style={!canGoNextWeek && styles.disabled}>
            ›
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.nightsRow} {...panResponder.panHandlers}>
        {nights.map((night, index) => {
          const isSelected = night.dateKey === selectedDateKey;
          const barHeight =
            night.count === 0
              ? BAR_MIN_HEIGHT
              : Math.max(BAR_MIN_HEIGHT, Math.round((night.count / busiest) * BAR_MAX_HEIGHT));

          // Screen readers get the full date and the actual count, since
          // neither the single-letter weekday nor the bar height survives
          // being read aloud. The selected night also announces how to undo it.
          const label = [
            night.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
            night.count === 1 ? '1 show' : `${night.count} shows`,
            night.isToday ? 'today' : null,
            isSelected ? 'selected, tap to clear' : null,
          ]
            .filter(Boolean)
            .join(', ');

          return (
            <Pressable
              key={night.dateKey}
              // Tapping the selected night clears it, so the strip can undo
              // its own filter without sending the user to the date sheet.
              onPress={() => onSelectDateKey(isSelected ? null : night.dateKey)}
              disabled={night.count === 0 && !isSelected}
              // Vertical slop only. Widening the touch box sideways would make
              // neighbouring nights overlap, which turns a near-miss into the
              // wrong day rather than no-op — worse than missing.
              hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected, disabled: night.count === 0 && !isSelected }}
              style={({ pressed }) => [
                styles.night,
                // Every night is a box, including empty ones. Painting only the
                // nights with shows left ragged gaps in the row and made the
                // strip read as scattered bars rather than seven days you can
                // press. Empty ones are dimmed instead of hidden — still
                // legible as a day, still obviously not offering anything.
                { backgroundColor: theme.backgroundElement },
                night.count === 0 && !isSelected && styles.nightEmpty,
                isSelected && {
                  backgroundColor: theme.backgroundSelected,
                  borderColor: theme.accent,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="eyebrow"
                themeColor={isSelected ? 'text' : 'textSecondary'}
                style={styles.weekdayInitial}>
                {WEEKDAY_INITIALS[index]}
              </ThemedText>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: isSelected
                        ? theme.accent
                        : night.count === 0
                          ? theme.border
                          : theme.accentText,
                      // Dim unselected bars only while some night is selected,
                      // so the chosen one reads as chosen without repainting
                      // the whole strip when nothing is.
                      opacity: selectedDateKey && !isSelected ? 0.45 : 1,
                    },
                  ]}
                />
              </View>

              <ThemedText
                type="eyebrow"
                themeColor={isSelected ? 'text' : 'textSecondary'}
                style={[styles.dayNumber, night.isToday && { color: theme.accentText }]}>
                {night.date.getDate()}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.three,
    borderRadius: Radius.card,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  chevron: {
    minWidth: Spacing.four,
    alignItems: 'center',
  },
  nightsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // flex:1 splits the row seven ways rather than assuming a device width. At
  // 393pt that lands near 44 per column, and the taller padding below pushes
  // the box well past MinTouchTarget vertically, which is the axis a thumb
  // actually misses on — the columns are only as wide as a seventh of the
  // screen no matter what.
  night: {
    flex: 1,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    marginHorizontal: 2,
    borderRadius: Radius.card,
    // Transparent by default so the selected state can turn it on without the
    // box resizing by two pixels when it does.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  nightEmpty: {
    opacity: 0.4,
  },
  weekdayInitial: {
    letterSpacing: 0,
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
  },
  // Wider than the original 8pt: at arm's length on a phone the bar is the
  // thing the eye aims at, even though the whole column is what accepts the tap.
  bar: {
    width: 12,
    borderRadius: Radius.pill,
  },
  dayNumber: {
    letterSpacing: 0,
    fontWeight: Fonts.weight.bold,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
});
