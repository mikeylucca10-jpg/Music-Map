import { useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * How much of the screen the sheet covers at each rest position.
 *
 * Three, not two. Peek is one card and a glimpse of the next, which is what
 * says the sheet moves without being told; half is the working position where
 * map and list are both usable; full is for reading the list and forgetting
 * the map is there. Two positions force a choice between seeing the map and
 * seeing the shows, which is the split this replaces.
 */
/**
 * Exported so the map overlays can sit clear of the sheet at rest rather than
 * hard-coding a matching number that drifts the first time this one changes.
 */
export const MAP_SHEET_PEEK_FRACTION = 0.34;

const SNAP_FRACTIONS = [MAP_SHEET_PEEK_FRACTION, 0.62, 0.9];
const MAX_FRACTION = SNAP_FRACTIONS[SNAP_FRACTIONS.length - 1];

/** Past this, a flick decides the direction regardless of how far it travelled. */
const FLICK_VELOCITY = 0.5;

type MapSheetProps = {
  /** Rendered inside the sheet's scroll area — the concert cards. */
  children: ReactNode;
  /** Shown in the handle row, e.g. "9 shows". The one number worth a permanent
   *  slot: it is how you know a filter did anything. */
  countLabel: string;
};

/**
 * The draggable sheet over the map on Explore.
 *
 * Explore used to be a map where tapping a pin threw you to a full screen, so
 * looking at three shows meant leaving and returning three times, losing the
 * map position each trip. Every mature map-search product solved this the same
 * way — map behind, sheet in front, several rest positions — because the two
 * views answer different halves of one question: the map says *where*, the list
 * says *what time, who else is on, how far*.
 *
 * Deliberately not a toggle between map and list. A toggle costs a tap, throws
 * away the map's context each way, and tends to grow two slightly different
 * versions of the same controls.
 *
 * The drag lives on the handle, never the body. A responder over the cards
 * would fight the ScrollView for every vertical gesture, and a list you cannot
 * scroll is a worse trade than a sheet you have to grab by its handle.
 */
export function MapSheet({ children, countLabel }: MapSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const sheetHeight = height * MAX_FRACTION;
  // Offsets measured from fully open. Peek is the largest push-down.
  const offsets = useMemo(
    () => SNAP_FRACTIONS.map((fraction) => (MAX_FRACTION - fraction) * height),
    [height],
  );
  const peekOffset = offsets[0];

  // useState rather than useRef: the value is read during render (it goes into
  // the transform), and reading a ref there is what the compiler rule forbids.
  const [translateY] = useState(() => new Animated.Value(0));
  // Where the sheet is resting, so a drag can be measured from it. Kept as an
  // index rather than a pixel value so a rotation recomputes offsets without
  // stranding the sheet at a stale position.
  const [snapIndex, setSnapIndex] = useState(0);

  // Starts at peek. Applied through the same Animated value the gesture uses,
  // so there is one source of truth for the position.
  const [hasPositioned, setHasPositioned] = useState(false);
  if (!hasPositioned) {
    setHasPositioned(true);
    translateY.setValue(peekOffset);
  }

  function settleAt(index: number) {
    setSnapIndex(index);
    Animated.spring(translateY, {
      toValue: offsets[index],
      useNativeDriver: true,
      bounciness: 2,
      speed: 14,
    }).start();
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          const next = offsets[snapIndex] + gesture.dy;
          // Clamped so the sheet cannot be dragged above full (leaving a gap
          // under it) or below peek (off the bottom of the screen).
          translateY.setValue(Math.min(peekOffset, Math.max(0, next)));
        },
        onPanResponderRelease: (_event, gesture) => {
          // A flick beats distance: a short fast drag means the same thing as a
          // long slow one, and requiring travel makes the sheet feel heavy.
          if (Math.abs(gesture.vy) > FLICK_VELOCITY) {
            const direction = gesture.vy > 0 ? -1 : 1;
            const target = Math.min(
              SNAP_FRACTIONS.length - 1,
              Math.max(0, snapIndex + direction),
            );
            settleAt(target);
            return;
          }
          // Otherwise settle wherever the finger actually left it.
          const landed = offsets[snapIndex] + gesture.dy;
          let nearest = 0;
          for (let i = 1; i < offsets.length; i++) {
            if (Math.abs(offsets[i] - landed) < Math.abs(offsets[nearest] - landed)) nearest = i;
          }
          settleAt(nearest);
        },
        // A cancelled gesture must not leave the sheet parked between positions.
        onPanResponderTerminate: () => settleAt(snapIndex),
      }),
    // settleAt closes over the current snapIndex and offsets; rebuilding the
    // responder when either changes keeps the drag measured from where the
    // sheet actually is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offsets, peekOffset, snapIndex, translateY],
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          height: sheetHeight,
          backgroundColor: theme.backgroundElement,
          transform: [{ translateY }],
        },
      ]}>
      {/* The whole handle row drags, not the 36x4 bar inside it — that bar is
          far too small to catch, and hitSlop does nothing on web. */}
      <View style={styles.handleRow} {...panResponder.panHandlers}>
        <View style={styles.grabber} />
        <ThemedText type="eyebrow" themeColor="textSecondary">
          {countLabel}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    // Above Leaflet's own controls, which sit at z-index 1000 in its default
    // CSS — the same trap the filter bar overlay documents.
    zIndex: 1050,
  },
  handleRow: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.grabber,
  },
  scroll: { flex: 1 },
  scrollContent: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
