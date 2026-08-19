import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DatePickerSheet } from '@/components/date-picker-sheet';
import { NightDensityStrip, type WeekNight } from '@/components/night-density-strip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { Category } from '@/hooks/use-concerts-filters';
import { useTheme } from '@/hooks/use-theme';
import { formatDateKeyLabel } from '@/lib/format-date';
import { City } from '@/types/concert';

type ConcertsFilterBarProps = {
  category: Category;
  onCategoryChange: (category: Category) => void;
  categories: readonly Category[];
  city: City;
  onCityChange: (city: City) => void;
  cities: City[];
  selectedBoroughId?: string | null;
  onBoroughChange?: (boroughId: string | null) => void;
  selectedDateKey?: string | null;
  onDateChange?: (dateKey: string | null) => void;
  weekLabel?: string;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  canGoPrevWeek?: boolean;
  canGoNextWeek?: boolean;
  weekNavRelevant?: boolean;
  setWeekOffset?: (offset: number) => void;
  /** Only rendered when the viewer follows something — see followCount. */
  followingOnly?: boolean;
  onFollowingOnlyChange?: (value: boolean) => void;
  followCount?: number;
  /** Shows matching the current filters, for the live-region announcement. */
  resultCount?: number;
  /** The visible week's seven nights with per-night show counts, for the strip. */
  weekNights?: WeekNight[];
};

export function ConcertsFilterBar({
  category,
  onCategoryChange,
  categories,
  city,
  onCityChange,
  cities,
  selectedBoroughId = null,
  onBoroughChange,
  selectedDateKey = null,
  onDateChange,
  weekLabel,
  onPrevWeek,
  onNextWeek,
  canGoPrevWeek = false,
  canGoNextWeek = false,
  weekNavRelevant = true,
  setWeekOffset,
  weekNights,
  followingOnly = false,
  onFollowingOnlyChange,
  followCount = 0,
  resultCount,
}: ConcertsFilterBarProps) {
  const theme = useTheme();
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  // "Any night" rather than today's date when nothing is picked. The pill used
  // to default to today, which openly contradicted the strip beside it — the
  // pill would read "Sun, Aug 16" while the strip showed Aug 24–30. Today's
  // date is not the filter state; no filter is, and the label should say so.
  const selectedDateLabel = selectedDateKey ? formatDateKeyLabel(selectedDateKey) : 'Any night';
  const selectedBorough = city.boroughs?.find((borough) => borough.id === selectedBoroughId);
  const cityPillLabel = selectedBorough?.label ?? city.label;

  function selectCity(item: City) {
    onCityChange(item);
    onBoroughChange?.(null);
    setCityMenuOpen(false);
  }

  function selectBorough(item: City, boroughId: string) {
    onCityChange(item);
    onBoroughChange?.(boroughId);
    setCityMenuOpen(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.pillsRow}>
        {/* Rendered only once something is followed. A control that can only
            ever return an empty list is worse than no control, and hiding it
            until it works also keeps the row from growing for people who have
            not followed anything yet. Deliberately a visible pill rather than
            an item inside the Filters dropdown -- menus hide options, and this
            is the one filter that makes the list personal. */}
        {followCount > 0 && onFollowingOnlyChange && (
          <Pressable
            onPress={() => onFollowingOnlyChange(!followingOnly)}
            accessibilityRole="button"
            accessibilityState={{ selected: followingOnly }}
            accessibilityLabel={
              followingOnly
                ? `Showing only shows you follow${typeof resultCount === 'number' ? `, ${resultCount} shows` : ''}. Tap to show all.`
                : `Show only shows from the ${followCount} artists and venues you follow`
            }
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type={followingOnly ? 'backgroundSelected' : 'backgroundElement'} style={styles.cityPill}>
              <ThemedText type="smallBold" style={followingOnly ? { color: theme.accentText } : undefined}>
                {followingOnly ? '✓ Following' : 'Following'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}

        <View style={styles.pillWrapper}>
          <Pressable
            onPress={() => setCityMenuOpen((open) => !open)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.cityPill}>
              <ThemedText type="smallBold">{cityPillLabel} ▾</ThemedText>
            </ThemedView>
          </Pressable>

          {cityMenuOpen && (
            <ThemedView type="backgroundElement" style={styles.cityMenu}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {cities.map((item) => {
                  const isActiveCity = item.id === city.id;
                  return (
                    <View key={item.id}>
                      <Pressable
                        onPress={() => selectCity(item)}
                        style={({ pressed }) => [styles.cityMenuItem, pressed && styles.pressed]}>
                        <ThemedText
                          type={isActiveCity && !selectedBorough ? 'smallBold' : 'small'}
                          themeColor={isActiveCity && !selectedBorough ? 'text' : 'textSecondary'}>
                          {item.label}
                        </ThemedText>
                      </Pressable>
                      {item.boroughs?.map((borough) => {
                        const isSelectedBorough = isActiveCity && borough.id === selectedBoroughId;
                        return (
                          <Pressable
                            key={borough.id}
                            onPress={() => selectBorough(item, borough.id)}
                            style={({ pressed }) => [styles.boroughMenuItem, pressed && styles.pressed]}>
                            <ThemedText
                              type={isSelectedBorough ? 'smallBold' : 'small'}
                              themeColor={isSelectedBorough ? 'text' : 'textSecondary'}>
                              {borough.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>
            </ThemedView>
          )}
        </View>

        {onDateChange && (
          <View style={styles.pillWrapper}>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.cityPill}>
                <ThemedText type="smallBold">{selectedDateLabel} ▾</ThemedText>
              </ThemedView>
            </Pressable>

            <DatePickerSheet
              visible={datePickerOpen}
              selectedDateKey={selectedDateKey}
              onApply={onDateChange}
              onClose={() => setDatePickerOpen(false)}
              onSelectThisWeek={setWeekOffset ? () => setWeekOffset(0) : undefined}
              onSelectNextWeek={onNextWeek}
              weekLabel={weekLabel}
            />
          </View>
        )}

        <View style={styles.pillWrapper}>
          <Pressable
            onPress={() => setFiltersMenuOpen((open) => !open)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.cityPill}>
              <ThemedText type="smallBold">Filters ▾</ThemedText>
            </ThemedView>
          </Pressable>

          {filtersMenuOpen && (
            <ThemedView type="backgroundElement" style={styles.filtersMenu}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {categories.map((item) => {
                  const selected = item === category;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        onCategoryChange(item);
                        setFiltersMenuOpen(false);
                      }}
                      style={({ pressed }) => [styles.cityMenuItem, pressed && styles.pressed]}>
                      <ThemedText
                        type={selected ? 'smallBold' : 'small'}
                        themeColor={selected ? 'text' : 'textSecondary'}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </ThemedView>
          )}
        </View>
      </View>

      {/* The old "‹ This Week ›" row lived here. It has been replaced by
          NightDensityStrip, which does the same paging and additionally shows
          what is actually on each night. */}
      {weekLabel && onPrevWeek && onNextWeek && weekNavRelevant && weekNights && onDateChange && (
        <NightDensityStrip
          nights={weekNights}
          selectedDateKey={selectedDateKey}
          onSelectDateKey={onDateChange}
          weekLabel={weekLabel}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
          canGoPrevWeek={canGoPrevWeek}
          canGoNextWeek={canGoNextWeek}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    // React Native Web stamps every plain View with its own z-index:0
    // stacking context by default, which traps cityMenu's zIndex below —
    // without this, later siblings on the host screen (e.g. list.tsx's
    // error/empty message card) paint over the open city dropdown.
    zIndex: 100,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    // Wins the stacking tie against the weekNavRow sibling below it (both
    // default to z-index:0 otherwise, and DOM order would let weekNavRow
    // paint over an open dropdown's bottom edge).
    zIndex: 1,
  },
  pillWrapper: {
    zIndex: 1,
  },
  cityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  cityMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    borderRadius: Radius.card,
    paddingVertical: Spacing.one,
    minWidth: 190,
    maxHeight: 340,
    zIndex: 10,
  },
  cityMenuItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  // Nested under a city entry (e.g. New York -> Manhattan, Brooklyn, ...)
  // rather than a separate chip row spread across the screen.
  boroughMenuItem: {
    paddingLeft: Spacing.five,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  // Same look as cityMenu, but right-aligned — this is the rightmost pill,
  // so opening from its left edge (like cityMenu does) would push the menu
  // off-screen on a narrow phone.
  filtersMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    borderRadius: Radius.card,
    paddingVertical: Spacing.one,
    minWidth: 160,
    maxHeight: 340,
    zIndex: 10,
  },
});
