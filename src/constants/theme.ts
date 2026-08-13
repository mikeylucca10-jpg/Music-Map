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
  backgroundSelected: '#242226',
  textSecondary: '#9B9BA3',
  accent: '#8B5CF6',
  accentInk: '#FFFFFF',
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
