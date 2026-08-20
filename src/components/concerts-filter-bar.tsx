import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DatePickerSheet } from '@/components/date-picker-sheet';
import { NightDensityStrip, type WeekNight } from '@/components/night-density-strip';
import { SelectSheet, type SelectOption } from '@/components/select-sheet';
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

  // One value, not three booleans. Two independent flags previously let both
  // dropdowns be open at once, because nothing in that shape could express "at
  // most one". Now that all three selectors are sheets the Modal enforces it
  // visually too, but the invariant belongs in the state either way.
  const [openSheet, setOpenSheet] = useState<'city' | 'filters' | 'date' | null>(null);

  // "Any night" rather than today's date when nothing is picked. The pill used
  // to default to today, which openly contradicted the strip beside it — the
  // pill would read "Sun, Aug 16" while the strip showed Aug 24–30. Today's
  // date is not the filter state; no filter is, and the label should say so.
  const selectedDateLabel = selectedDateKey ? formatDateKeyLabel(selectedDateKey) : 'Any night';
  const selectedBorough = city.boroughs?.find((borough) => borough.id === selectedBoroughId);
  const cityPillLabel = selectedBorough?.label ?? city.label;

  // Cities and their boroughs flattened into one list, boroughs indented under
  // the city they belong to. Picking "Brooklyn" therefore sets both city and
  // borough in a single tap, and the nesting is what makes that relationship
  // readable — a separate borough control would imply the two are independent
  // choices, which they are not.
  const cityOptions: SelectOption[] = cities.flatMap((item) => [
    { id: item.id, label: item.label },
    ...(item.boroughs ?? []).map((borough) => ({
      id: `${item.id}:${borough.id}`,
      label: borough.label,
      nested: true,
    })),
  ]);
  const selectedCityOptionId = selectedBorough ? `${city.id}:${selectedBorough.id}` : city.id;

  function handleCitySelect(optionId: string) {
    const [cityId, boroughId] = optionId.split(':');
    const nextCity = cities.find((item) => item.id === cityId);
    if (!nextCity) return;
    onCityChange(nextCity);
    onBoroughChange?.(boroughId ?? null);
  }

  const categoryOptions: SelectOption[] = categories.map((item) => ({
    id: item,
    label: item,
    // Named where they are chosen rather than in a legend somewhere else. These
    // four are keyword guesses against the event title, not real fields, and
    // someone picking one deserves to know it may miss things. There was never
    // room to say so in a dropdown row; a sheet has the space.
    detail:
      item === 'Pop-ups' || item === 'Festivals' || item === 'Clubs' || item === 'Day Parties'
        ? 'Matched from the event name'
        : undefined,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.pillsRow}>
        <FilterPill
          label={cityPillLabel}
          onPress={() => setOpenSheet('city')}
          active={Boolean(selectedBorough)}
          opens
          accessibilityLabel={`Where: ${cityPillLabel}. Change city or borough`}
        />

        {onDateChange && (
          <FilterPill
            label={selectedDateLabel}
            onPress={() => setOpenSheet('date')}
            active={Boolean(selectedDateKey)}
            opens
            accessibilityLabel={`Date: ${selectedDateLabel}. Change date`}
          />
        )}

        {/* Names the active category rather than always reading "Filters". The
            City and Date pills already show their own state; this one did not,
            which is the gap that has people opening a menu just to re-read what
            they picked. */}
        <FilterPill
          label={category === 'All' ? 'Filters' : category}
          onPress={() => setOpenSheet('filters')}
          active={category !== 'All'}
          opens
          accessibilityLabel={
            category === 'All' ? 'Filters. None applied' : `Filter: ${category}. Change filter`
          }
        />

        {/* Rendered only once something is followed. A control that can only
            ever return an empty list is worse than no control, and hiding it
            until it works also keeps the row from growing for people who have
            not followed anything yet. Deliberately a visible pill rather than
            an item inside the Filters sheet — a sheet hides its options until
            opened, and this is the one filter that makes the list personal. */}
        {followCount > 0 && onFollowingOnlyChange && (
          <FilterPill
            label={followingOnly ? '✓ Following' : 'Following'}
            onPress={() => onFollowingOnlyChange(!followingOnly)}
            active={followingOnly}
            selected={followingOnly}
            accessibilityLabel={
              followingOnly
                ? `Showing only shows you follow${typeof resultCount === 'number' ? `, ${resultCount} shows` : ''}. Tap to show all.`
                : `Show only shows from the ${followCount} artists and venues you follow`
            }
          />
        )}
      </View>

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
          {typeof resultCount === 'number' ? (
            <ThemedView type="backgroundElement" style={styles.resetChip}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.resetChipLabel}>
                {resultCount} {resultCount === 1 ? 'show' : 'shows'}
              </ThemedText>
            </ThemedView>
          ) : (
            <View />
          )}
          <Pressable
            onPress={onResetFilters}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${activeFilters
              .map((filter) => filter.label)
              .join(', ')}. Back to this week, all shows.`}
            hitSlop={10}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.resetChip}>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={[styles.resetChipLabel, { color: theme.accentText }]}>
                {activeFilters.length === 1
                  ? activeFilters[0].id === 'week'
                    ? 'Back to this week'
                    : `Clear ${activeFilters[0].label}`
                  : `Clear all ${activeFilters.length}`}
              </ThemedText>
            </ThemedView>
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

      {/* All three selectors are sheets now, so they share one dismissal model,
          one animation, and one place on screen — reachable by a thumb rather
          than pinned to the top edge. They also stop fighting the stacking
          context: React Native Web makes every View its own, and the old
          dropdowns needed two separate z-index fixes plus a hand-rolled
          full-screen backdrop just to be closable. A Modal has none of that. */}
      <SelectSheet
        visible={openSheet === 'city'}
        title="Where"
        options={cityOptions}
        selectedId={selectedCityOptionId}
        onSelect={handleCitySelect}
        onClose={() => setOpenSheet(null)}
      />

      <SelectSheet
        visible={openSheet === 'filters'}
        title="Show me"
        options={categoryOptions}
        selectedId={category}
        onSelect={(id) => onCategoryChange(id as Category)}
        onClose={() => setOpenSheet(null)}
      />

      {onDateChange && (
        <DatePickerSheet
          visible={openSheet === 'date'}
          timeZone={city.timezone}
          selectedDateKey={selectedDateKey}
          onApply={onDateChange}
          onClose={() => setOpenSheet(null)}
          onSelectThisWeek={setWeekOffset ? () => setWeekOffset(0) : undefined}
          onSelectNextWeek={onNextWeek}
          weekLabel={weekLabel}
        />
      )}
    </View>
  );
}

/**
 * One pill, so the four in the row cannot drift apart.
 *
 * They were four hand-rolled copies of the same markup and had already
 * diverged: some carried numberOfLines and some did not, and only one had an
 * accessible name. `active` raises the surface and tints the label together, so
 * an applied filter never signals itself with colour alone.
 */
function FilterPill({
  label,
  onPress,
  active,
  selected,
  opens,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  active: boolean;
  selected?: boolean;
  /** Appends a chevron. Marks the pills that open a sheet, so the Following
   *  toggle -- which just flips in place -- is visibly a different kind of
   *  control rather than looking like a menu that never opens. */
  opens?: boolean;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.pill}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={[styles.pillLabel, active && { color: theme.accentText }]}>
          {opens ? `${label} ▾` : label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // No z-index any more. The dropdowns needed the whole bar raised above the
  // rest of the screen so their absolutely-positioned menus were not painted
  // over by later siblings; a sheet renders in a Modal, above everything, by
  // construction. Two prior bug fixes lived in this style block and are gone
  // with the pattern that required them.
  container: {
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    // Everything fits one line: horizontally scrolling filter rows hide the
    // options past the edge, and lateral movement inside a vertical page is a
    // documented discoverability problem. Four compact pills fit 393pt.
    flexWrap: 'nowrap',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  // Small label so four pills fit; vertical padding untouched so the tap
  // target stays full height even though the pill is narrower.
  pillLabel: { fontSize: Fonts.size.xs },
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
  // Both ends are solid chips rather than bare text. On Explore this whole bar
  // is absolutely positioned *over* the Leaflet map, where light tiles sit
  // directly behind it — every other control there is already a filled pill for
  // that reason, and the reset row was the one thing relying on the dark app
  // background it does not have on that screen.
  resetChip: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  resetChipLabel: { fontSize: Fonts.size.xs },
});
