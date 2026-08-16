/**
 * This app is styled like a dark-first live-event app (TIXR/CrowdVolt-style):
 * near-black surfaces, image-forward cards, one accent color used sparingly.
 * `light` and `dark` intentionally share the same dark palette below — this
 * is a dark-only app by design, not an adaptive light/dark one.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  text: '#F5F5F7',
  background: '#0A0A0A',
  backgroundElement: '#161616',
  // Warm-tinted rather than neutral grey, so raised/selected surfaces sit in
  // the same colour family as the accent instead of fighting it.
  backgroundSelected: '#241F1F',
  textSecondary: '#9B9BA3',
  /**
   * Deliberately a deep vermillion rather than a neon red: bright enough to
   * carry the nightlife energy on near-black, dark enough that white
   * `accentInk` text on top clears WCAG AA (~4.5:1) at the 14px bold size the
   * accent pills actually use. A lighter coral looks punchier in isolation but
   * drops that to ~3.3:1, which fails at this text size.
   */
  accent: '#E03131',
  accentInk: '#FFFFFF',
  /**
   * The same red, lightened for use *as* text or an icon on a dark surface —
   * a fill colour and a text colour have opposite contrast requirements, and
   * `accent` itself only reaches ~4.4:1 on `background`. Close enough in hue
   * that the two read as one colour, not two.
   */
  accentText: '#EF4444',
  border: 'rgba(255, 255, 255, 0.08)',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 70 }) ?? 0;
export const MaxContentWidth = 800;

// One radius scale used everywhere so cards, rows, and pill buttons read as
// one consistent system rather than several ad hoc roundings.
export const Radius = {
  card: 16,
  large: 24,
  pill: 999,
} as const;
