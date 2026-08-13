import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';

type SkeletonCardProps = {
  width?: number;
};

// Pulsing dark-grey placeholder shown while concert images load, instead of
// a spinner — feels premium and hints at the image-forward card shape.
export function SkeletonCard({ width }: SkeletonCardProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.card, width ? { width } : styles.fullWidth, animatedStyle]}>
      <View style={styles.textLineWide} />
      <View style={styles.textLineNarrow} />
    </Animated.View>
  );
}

export function SkeletonCardRow({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 4 / 5,
    borderRadius: Radius.card,
    backgroundColor: '#1c1c1e',
    padding: Spacing.three,
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  fullWidth: {
    width: '100%',
  },
  row: {
    gap: Spacing.three,
  },
  textLineWide: {
    height: 16,
    width: '70%',
    borderRadius: Radius.card / 4,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  textLineNarrow: {
    height: 12,
    width: '45%',
    borderRadius: Radius.card / 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
