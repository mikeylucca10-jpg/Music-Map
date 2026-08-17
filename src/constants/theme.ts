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
  /**
   * A third plane, one step above `backgroundElement` and warm-tinted to match
   * `backgroundSelected`. Exists because the home screen was a flat wall of
   * identical cards on a single ground — with only two surface levels there is
   * no way to rank anything visually. Used by the night strip and section
   * headers to sit above the list without becoming a card themselves.
   */
  surfaceRaised: '#1E1A1A',
  textSecondary: '#9B9BA3',
  /**
   * Text drawn on top of poster art rather than on a theme surface. Pure white
   * and a muted white — the art behind them is arbitrary, so these are fixed
   * rather than theme-derived. Previously hardcoded inline in
   * concert-list-card.tsx; they live here so the card has no raw hex left.
   */
  overlayInk: '#FFFFFF',
  overlayInkMuted: 'rgba(255, 255, 255, 0.82)',
  /** Scrim behind overlay controls (the save button on poster art). */
  overlayScrim: 'rgba(10, 10, 10, 0.55)',
  /** Dimmer behind a modal sheet, separating it from the screen underneath. */
  backdrop: 'rgba(0, 0, 0, 0.6)',
  /** The drag handle on a bottom sheet. Brighter than `border` — it is an
   *  affordance the user is meant to notice, not a hairline. */
  grabber: 'rgba(255, 255, 255, 0.24)',
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

const fontFamilies = Platform.select({
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
})!;

/**
 * The name `useFonts` registers in `_layout.tsx`. Kept as a named constant so
 * the loader and every consumer cannot drift apart — a typo here silently
 * falls back to the system face rather than erroring.
 */
export const DisplayFontFamily = 'ArchivoExpanded';

/**
 * One modular type scale, replacing the eleven ad hoc `fontSize` values that
 * were previously scattered across components (11, 13, 18, 19, 20, 22, 26, 48
 * among them). Sizes only appear here.
 *
 * `base` is 16 because that is the floor for body text on mobile, and its 1.5
 * line height sits in the 1.5–1.75 band readable body copy needs. Headings run
 * tighter on purpose: leading that helps a wrapped paragraph makes a two-line
 * title look like two unrelated lines.
 */
const size = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 19,
  xl: 24,
  xxl: 32,
} as const;

const lineHeight = {
  xs: 16,
  sm: 20,
  base: 24,
  /** 1.32 — concert names routinely wrap to two or three lines. */
  lg: 25,
  xl: 30,
  xxl: 36,
} as const;

const weight = {
  regular: '400',
  medium: '500',
  bold: '700',
  heavy: '800',
} as const;

export const Fonts = { ...fontFamilies, display: DisplayFontFamily, size, lineHeight, weight };

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

/**
 * Scrim laid over poster art so overlaid text stays readable regardless of what
 * the image happens to be. Stops short of solid black at the base: the art
 * should still be legible through it, not cropped away by a bar.
 */
export const PosterGradient = {
  colors: ['transparent', 'rgba(0, 0, 0, 0.55)', 'rgba(0, 0, 0, 0.92)'] as const,
  locations: [0, 0.55, 1] as const,
};

/**
 * Minimum comfortable touch target. Controls smaller than this visually must
 * make up the difference with `hitSlop` — the 36pt save button plus 8pt of slop
 * reaches 52pt, which clears it.
 */
export const MinTouchTarget = 44;

/**
 * Roughly how wide a poster renders, in points: a full-bleed card on a phone,
 * less the screen's horizontal padding. Not exact, and does not need to be —
 * it only has to land in the right band of the source's size ladder.
 */
export const PosterDisplayWidth = 360;

/**
 * How many source pixels to request per display point.
 *
 * Phones are commonly 3x DPR, so 2 is already a compromise between sharpness
 * and bytes rather than a generous allowance. Tuning this is the single lever
 * over poster quality and download size — deliberately here beside the tokens
 * rather than inside pickImageForWidth, so it can be changed in one place after
 * seeing the result on a real screen.
 *
 * Measured against the live feed, per poster:
 *   2426px (largest available)  537 KB   <- what shipped before this existed
 *   1024px (this setting, 2x)   157 KB
 *    640px (1.5x)                73 KB
 * Dropping to 1.5 would roughly halve the bytes again, at half the device's
 * resolution on the art that is the visual centre of the card.
 */
export const PosterImageScale = 2;
