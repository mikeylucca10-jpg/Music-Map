import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ConcertStatus } from '@/types/concert';

/**
 * What each status is worth saying, and nothing for the ones that are not.
 *
 * `onsale` and `undefined` both render nothing: the overwhelming majority of
 * listings are on sale, and a tag on every card would say nothing while costing
 * a line on all of them. A badge is only information when it is rare.
 *
 * `offsale` is deliberately absent too. It means tickets are not currently
 * being sold — which for a club night is as often "not on sale yet" as "gone",
 * and the API does not distinguish them. Guessing "SOLD OUT" from it would be a
 * confident claim about something unknown, which is the same failure as the
 * mock prices the terms already have to disclaim.
 */
const LABELS: Partial<Record<ConcertStatus, string>> = {
  cancelled: 'Cancelled',
  postponed: 'Postponed',
  rescheduled: 'Rescheduled',
};

/**
 * Says when a show is not happening as listed.
 *
 * The feed carries this on every event and the app ignored it, so a cancelled
 * show sat in the list looking exactly like a real one, with a working "Buy
 * Tickets" row underneath. Sending someone across a city to a show that is not
 * happening is a worse failure than any empty state.
 *
 * Measured on the live NYC feed: 2 of 131 events were not on sale. Rare enough
 * that a tag stays meaningful, common enough that it will be seen.
 *
 * Uses the accent as a fill rather than as text — this sits on poster art, not
 * on the app's dark ground, so it needs its own background to be legible at
 * all. That is the same reason the map pin uses `accent` rather than
 * `accentText`.
 */
export function ConcertStatusTag({ status }: { status?: ConcertStatus }) {
  const theme = useTheme();
  const label = status ? LABELS[status] : undefined;
  if (!label) return null;

  return (
    <View style={[styles.tag, { backgroundColor: theme.accent }]}>
      <ThemedText type="eyebrow" style={{ color: theme.accentInk }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Whether this status should stop the ticket links being offered. */
export function isOffSale(status?: ConcertStatus) {
  return status === 'cancelled' || status === 'postponed';
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
});
