import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FollowChipProps = {
  label: string;
  active: boolean;
  pending: boolean;
  onPress: () => void;
};

/**
 * A follow control sized to sit beside its sibling on one line.
 *
 * Deliberately not a wide filled button. The convention people already know is
 * Instagram's — a compact control that swaps its glyph and settles into a quiet
 * "following" state — and the confirmation comes from the *state change*, not
 * from shouting. Spotify moved their own follow control to a heart for the same
 * reason: a loud fill on every followable thing turns a page into a wall of
 * buttons.
 *
 * The glyph carries the state as well as the colour, so it survives both
 * colour-blindness and a screen reader, and the label stays the name rather
 * than becoming "Following Black Coffee" — the name is the content, the state
 * is decoration on it.
 */
export function FollowChip({ label, active, pending, onPress }: FollowChipProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  function handlePress() {
    // Celebratory only: a haptic on follow, silence on unfollow. Same rule as
    // the save heart — firing identically in both directions says nothing about
    // which one happened.
    if (!active && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (!reduceMotion) {
      // A dip and overshoot rather than a linear tween: spring physics reads as
      // physical rather than mechanical, and the whole gesture lands inside the
      // 200-500ms band where feedback is fast enough to feel instant but slow
      // enough to be seen at all.
      // .set() rather than assigning .value: Reanimated 4 rejects the direct
      // assignment outside a worklet.
      scale.set(
        withSequence(
          withTiming(0.92, { duration: 90 }),
          withSpring(1, { damping: 9, stiffness: 220 }),
        ),
      );
    }
    onPress();
  }

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        disabled={pending}
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled: pending }}
        accessibilityLabel={active ? `Unfollow ${label}` : `Follow ${label}`}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: active ? theme.backgroundSelected : theme.surfaceOverlay,
            borderColor: active ? theme.accentText : theme.border,
          },
          (pressed || pending) && styles.pressed,
        ]}>
        <ThemedText
          allowFontScaling={false}
          style={[styles.glyph, { color: active ? theme.accentText : theme.textSecondary }]}>
          {active ? '✓' : '+'}
        </ThemedText>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={[styles.label, { color: active ? theme.text : theme.textSecondary }]}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // flexShrink on the wrapper rather than the Pressable: the animated transform
  // needs its own layout box, and shrinking here is what lets two long names
  // share a line instead of pushing the second one off it.
  wrapper: { flexShrink: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  // Off-scale: a single glyph optically aligned against the label beside it.
  glyph: { fontSize: 15, lineHeight: 17 },
  label: { fontSize: Fonts.size.xs, flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
