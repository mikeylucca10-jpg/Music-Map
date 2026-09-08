import { useMemo, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

/** Far enough that a thumb resting on the grabber does not dismiss by accident. */
const DISMISS_DISTANCE = 90;

/** A fast flick dismisses regardless of distance, so the sheet has weight. */
const DISMISS_VELOCITY = 0.6;

/**
 * Drag-down-to-dismiss for the bottom sheets.
 *
 * Every sheet already drew a grabber, which universally means "drag me", and
 * nothing listened — the affordance promised a gesture that did not exist. The
 * ✕ stays: dragging is hidden, so it can be the fast path but not the only one.
 *
 * Attach `panHandlers` to the grabber and header only. A responder over the body
 * fights the sheet's own ScrollView, and the sheets worth dismissing are exactly
 * the ones long enough to scroll.
 */
export function useSheetDrag(onDismiss: () => void) {
  // useState, not useRef: the value is read during render (it goes into the
  // returned style), which the compiler rule forbids for a ref.
  const [translateY] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Downward and clearly vertical only — up has no meaning at full
        // height, and claiming horizontal would swallow the header's gestures.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          // Clamped so it cannot be dragged up and leave a gap beneath.
          if (gesture.dy > 0) translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            onDismiss();
            // Reset, not animate: the Modal runs its own slide-down, and both
            // at once moves twice as fast as the finger did. Also means the
            // next open starts at rest.
            translateY.setValue(0);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
        // A stolen gesture must not park the sheet halfway down.
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
