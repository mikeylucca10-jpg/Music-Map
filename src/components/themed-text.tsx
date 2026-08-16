import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'eyebrow'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'eyebrow' && styles.eyebrow,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.accentText }],
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Every size and line height here comes from the scale in constants/theme.ts.
// No raw numbers: a new one added locally is a new scale step nobody agreed to.
const styles = StyleSheet.create({
  small: {
    fontSize: Fonts.size.sm,
    lineHeight: Fonts.lineHeight.sm,
    fontWeight: Fonts.weight.medium,
  },
  smallBold: {
    fontSize: Fonts.size.sm,
    lineHeight: Fonts.lineHeight.sm,
    fontWeight: Fonts.weight.bold,
  },
  default: {
    fontSize: Fonts.size.base,
    lineHeight: Fonts.lineHeight.base,
    fontWeight: Fonts.weight.medium,
  },
  // The display face is confined to `title` and `subtitle` — the two largest
  // steps. Archivo Expanded is wide and heavy by design; at body sizes it stops
  // being characterful and just becomes hard to read.
  title: {
    fontFamily: Fonts.display,
    fontSize: Fonts.size.xxl,
    lineHeight: Fonts.lineHeight.xxl,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: Fonts.size.xl,
    lineHeight: Fonts.lineHeight.xl,
    letterSpacing: -0.3,
  },
  // Small uppercase label for section headers ("Buy Tickets", "Saved
  // Concerts") — the "gig poster" accent, used sparingly, not on body text.
  eyebrow: {
    fontSize: Fonts.size.xs,
    lineHeight: Fonts.lineHeight.xs,
    fontWeight: Fonts.weight.heavy,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Links keep the roomier `xl` leading at `sm` size: it is doing tap-target
  // work here, not typographic work, since these sit inline in running text.
  link: {
    fontSize: Fonts.size.sm,
    lineHeight: Fonts.lineHeight.xl,
  },
  linkPrimary: {
    fontSize: Fonts.size.sm,
    lineHeight: Fonts.lineHeight.xl,
    fontWeight: Fonts.weight.bold,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: Fonts.weight.bold }) ?? Fonts.weight.medium,
    fontSize: Fonts.size.xs,
  },
});
