import { Pressable, StyleSheet, Text } from 'react-native';

import { Fonts, MinTouchTarget, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Apple asks for 44x44pt, Android for 48x48dp. Both steppers this replaces
 * were far under: the week arrows were a 24x20 box and the month arrows had
 * no box at all — just the glyph, about 12pt wide.
 *
 * Both leaned on `hitSlop` to make up the difference, which does not work
 * here. React Native Web does not implement hitSlop on Pressable, so on web
 * the visible glyph *was* the entire target. The size is a real style now
 * rather than an invisible prop, so it holds on every platform.
 */

type StepperButtonProps = {
  direction: 'prev' | 'next';
  onPress: () => void;
  disabled?: boolean;
  /**
   * Required, not optional. A bare "‹" is read aloud as punctuation, so each
   * arrow has to say where it goes ("Previous week", "Next month, July").
   */
  accessibilityLabel: string;
};

/**
 * The paging arrow shared by the night strip's week nav and the date picker's
 * month nav.
 *
 * Filled rather than a bare glyph. The two arrows sit at the ends of a row
 * whose middle is a plain text label, so with no background they read as part
 * of that label rather than as controls — the reason they were easy to miss
 * as well as easy to mis-tap. The circle matches the night boxes directly
 * below it in the strip, where a filled box already means "press this."
 */
export function StepperButton({
  direction,
  onPress,
  disabled = false,
  accessibilityLabel,
}: StepperButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        // Fill *and* hairline, because the two hosts sit on different grounds.
        // In the night strip the card is surfaceRaised, so the darker fill
        // alone reads. The date sheet is itself backgroundElement, where that
        // same fill is the exact colour of the sheet and the button
        // disappeared entirely — a 44pt target nobody can see is no better
        // than the 12pt one it replaced. The border is what survives both.
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        // Dimmed as a whole rather than only greying the glyph: at the end of
        // the range the button is still a 44pt target that no longer does
        // anything, and fading the circle with it is what says so.
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text
        allowFontScaling={false}
        style={[styles.glyph, { color: disabled ? theme.textSecondary : theme.text }]}>
        {direction === 'prev' ? '‹' : '›'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: Fonts.size.xl,
    // Off-scale line height on purpose, and commented here for the same
    // reason the save glyph is: this is one character optically centred in a
    // fixed circle, so the line box is doing centring rather than typographic
    // work. The chevron's ink sits high in its em box, so matching the font
    // size would park it visibly above the middle.
    lineHeight: Fonts.size.xl + 2,
    fontWeight: Fonts.weight.bold,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.6,
  },
});
