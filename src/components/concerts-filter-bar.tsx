import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DatePickerSheet } from '@/components/date-picker-sheet';
import { NightDensityStrip, type WeekNight } from '@/components/night-density-strip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
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
  /** Everything currently narrowing the list — drives the reset row. */
  activeFilters?: { id: string; label: string }[];
  onResetFilters?: () => void;
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
  activeFilters = [],
  onResetFilters,
}: ConcertsFilterBarProps) {
  const theme = useTheme();
  // One value, not two booleans. Two independent flags let both dropdowns be
  // open at once -- tapping City while Filters was down left them overlapping,
  // because nothing in the old shape could express "at most one". This makes
  // that unrepresentable rather than a rule someone has to remember at each
  // call site.
  const [openMenu, setOpenMenu] = useState<'city' | 'filters' | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const cityMenuOpen = openMenu === 'city';
  const filtersMenuOpen = openMenu === 'filters';
  const toggleMenu = (menu: 'city' | 'filters') =>
    setOpenMenu((current) => (current === menu ? null : menu));

  // Close on the way out, so leaving for a concert and coming back does not
  // land on a menu left hanging open. The screen stays mounted underneath a
  // pushed route, so without this its state survives the trip.
  useFocusEffect(
    useCallback(
      () => () => {
        setOpenMenu(null);
      },
      [],
    ),
  );
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
    setOpenMenu(null);
  }

  function selectBorough(item: City, boroughId: string) {
    onCityChange(item);
    onBoroughChange?.(boroughId);
    setOpenMenu(null);
  }

  return (
    <View style={styles.container}>
      {/* Light dismiss. Apple's HIG treats tapping outside as the way to close
          a menu — "no changes applied", no explicit Cancel needed — and without
          it the only way out was to hit the same pill again, which is not where
          anyone reaches. Deliberately swallows the tap rather than passing it
          through to whatever sat underneath: the first tap means "close this",
          and acting on the thing behind it would be an unintended selection.

          Sized in viewport units rather than inset:0 because it has to cover
          the whole screen while living inside the bar's own container. */}
      {openMenu && (
        <Pressable
          onPress={() => setOpenMenu(null)}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={styles.backdrop}
        />
      )}

      <View style={styles.pillsRow}>
        <View style={styles.pillWrapper}>
          <Pressable
            onPress={() => toggleMenu('city')}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.cityPill}>
              <ThemedText type="smallBold" style={styles.pillLabel} numberOfLines={1}>{cityPillLabel} ▾</ThemedText>
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
              onPress={() => {
                // The date sheet is a third menu in every sense except that it
                // renders as a modal, so opening it dismisses the other two.
                setOpenMenu(null);
                setDatePickerOpen(true);
              }}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.cityPill}>
                <ThemedText type="smallBold" style={styles.pillLabel} numberOfLines={1}>{selectedDateLabel} ▾</ThemedText>
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
            onPress={() => toggleMenu('filters')}
            style={({ pressed }) => pressed && styles.pressed}>
            {/* Names the active category rather than always reading "Filters".
                City and Date pills already show their own state; this one did
                not, which is the gap that has people opening a filter menu just
                to re-read what they picked. Selected state is carried by the
                label text *and* the raised surface, not colour alone. */}
            <ThemedView
              type={category === 'All' ? 'backgroundElement' : 'backgroundSelected'}
              style={styles.cityPill}>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={[styles.pillLabel, category !== 'All' && { color: theme.accentText }]}>
                {category === 'All' ? 'Filters' : category} ▾
              </ThemedText>
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
                        setOpenMenu(null);
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
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={[styles.pillLabel, followingOnly ? { color: theme.accentText } : null]}>
                {followingOnly ? '✓ Following' : 'Following'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}      </View>

      {/* Only exists while something is actually narrowing the list, which is
          both the researched pattern and a hard layout requirement here: a
          fifth always-on pill measured 386pt against a 361pt budget at 393pt
          and pushed the row off-screen. Its own row instead of a pill also
          keeps it reachable on Pop-ups, where the strip below hides itself.

          The label names what it will undo when that is one specific thing —
          "Clear 21+" beats a bare "Reset", which says nothing about what is
          about to change. Past one it becomes a count, since listing four
          filters would wrap. */}
      {activeFilters.length > 0 && onResetFilters && (
        <View style={styles.resetRow}>
          {/* The count shares this line rather than the reset sitting alone.
              Communicating filter state means saying how much survived the
              filter, not just that one is on — and a lone link floating on its
              own row read as an orphan with nothing to anchor it. */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.resetCount}>
            {typeof resultCount === 'number'
              ? `${resultCount} ${resultCount === 1 ? 'show' : 'shows'}`
              : ''}
          </ThemedText>
          <Pressable
            onPress={onResetFilters}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${activeFilters
              .map((filter) => filter.label)
              .join(', ')}. Back to this week, all shows.`}
            hitSlop={10}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
            <ThemedText type="small" style={{ color: theme.accentText }}>
              {activeFilters.length === 1
                ? activeFilters[0].id === 'week'
                  ? 'Back to this week'
                  : `Clear ${activeFilters[0].label}`
                : `Clear all ${activeFilters.length}`}
            </ThemedText>
          </Pressable>
        </View>
      )}

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
    gap: Spacing.one,
    // Everything fits one line: horizontally scrolling filter rows hide the
    // options past the edge, and lateral movement inside a vertical page is a
    // documented discoverability problem. Four compact pills fit 393pt.
    // Wins the stacking tie against the weekNavRow sibling below it (both
    // default to z-index:0 otherwise, and DOM order would let weekNavRow
    // paint over an open dropdown's bottom edge). Also has to out-rank the
    // backdrop, so the pills and the open menu stay above it while everything
    // else on the screen sits beneath.
    zIndex: 2,
  },
  // Between the pills (2) and everything else (0): the menus stay tappable,
  // the list, strip and reset row below do not. Extends far past the bar in
  // every direction so a tap anywhere on the screen counts as "outside".
  backdrop: {
    position: 'absolute',
    top: -400,
    bottom: -1200,
    left: -400,
    right: -400,
    zIndex: 1,
  },
  pillWrapper: {
    zIndex: 1,
  },
  // Right-aligned: it is an escape hatch, not a primary action, and the left
  // edge is where the pills that *set* filters start.
  // paddingHorizontal so the row's ends line up with the pills above it: the
  // bar's container is full-bleed (measured 0-393 at 393pt), so without this
  // the reset text sat 4pt from the screen edge while the pills stopped at
  // 385 — close enough to look like a mistake rather than a margin.
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  resetCount: {
    paddingHorizontal: Spacing.one,
  },
  resetButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  cityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  // Small label so four pills fit; vertical padding untouched so the tap
  // target stays full height even though the pill is narrower.
  pillLabel: { fontSize: Fonts.size.xs },
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
