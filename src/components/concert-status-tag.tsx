import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ConcertStatus } from '@/types/concert';

/**
 * Only the states worth saying. onsale and undefined render nothing — a badge on
 * every card is information on none of them.
 *
 * offsale is deliberately absent: for a club night it is as often "not on sale
 * yet" as "gone", and the API does not distinguish them, so labelling it
 * "SOLD OUT" would be a confident claim about something unknown.
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
 * show sat in the list looking real, with a working "Buy Tickets" row beneath.
 * Measured live: 2 of 131 NYC events — rare enough to stay meaningful.
 *
 * Uses accent as a fill, not accentText: this sits on poster art rather than
 * the app's dark ground, so it needs its own background to be legible.
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
