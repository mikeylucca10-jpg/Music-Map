import { useMemo, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

/**
 * How far down the sheet has to travel before letting go dismisses it.
 *
 * Short enough that a deliberate flick works without a long drag, far enough
 * that a thumb resting on the grabber while reading does not throw the sheet
 * away.
 */
const DISMISS_DISTANCE = 90;

/**
 * A fast flick dismisses regardless of distance, which is what makes the
 * gesture feel like the sheet has weight rather than a threshold to cross.
 */
const DISMISS_VELOCITY = 0.6;

/**
 * Drag-down-to-dismiss for the bottom sheets.
 *
 * Every sheet in the app already drew a grabber — the small horizontal bar at
 * the top that, on every platform this ships to, means "drag me." Nothing was
 * listening, so the affordance was decoration promising a gesture that did not
 * exist. This makes it true rather than removing it.
 *
 * The close button stays. Dragging is a hidden gesture with nothing on screen
 * naming it, so it can be the fast path but must not be the only one; the ✕ is
 * what someone finds who has never been taught the drag.
 *
 * Attach `panHandlers` to the grabber and header only, never the whole sheet.
 * A responder over the body would fight the sheet's own ScrollView for every
 * vertical drag, and the list would stop scrolling — the sheets that need
 * dismissing are exactly the ones long enough to scroll.
 */
export function useSheetDrag(onDismiss: () => void) {
  // useState, not useRef. The value is read during render (it goes into the
  // returned style), and reading a ref there is exactly what the compiler
  // rule forbids. A lazy initialiser still constructs it only once.
  const [translateY] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Downward only, and only once the drag is clearly vertical. An upward
        // pull has no meaning here — the sheet is already at its full height —
        // and claiming horizontal movement would swallow gestures meant for
        // anything the header holds.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          // Clamped at zero so the sheet cannot be dragged up off its resting
          // position and leave a gap under it.
          if (gesture.dy > 0) translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            onDismiss();
            // Reset immediately rather than animating out. The Modal runs its
            // own slide-down on close, and animating this at the same time
            // moves the sheet twice as fast as the finger did. Resetting now
            // also means the next open starts at rest instead of wherever the
            // last drag ended.
            translateY.setValue(0);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
        // A cancelled gesture (a call arriving, a system sheet stealing it)
        // must not leave the sheet parked halfway down.
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [onDismiss, translateY],
  );

  return {
    panHandlers: panResponder.panHandlers,
    style: { transform: [{ translateY }] },
  };
}
