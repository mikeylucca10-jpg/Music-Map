/**
 * The four tab icons, drawn inline.
 *
 * These replace `expo-symbols`' web fallback, which resolved to
 * MaterialSymbols_400Regular.ttf — a 940KB icon font downloaded on every page
 * view to render four glyphs. That was more than eight times the size of the
 * app's actual display face, for four shapes that are a few hundred bytes each.
 *
 * Rendered as a data-URI SVG on a plain DOM <img>. React Native Web draws
 * through React DOM, so an intrinsic element is legitimate here — and this is a
 * .web.tsx, so it never reaches native, where SF Symbols render with no
 * download at all.
 *
 * Deliberately not React Native's <Image>: its web loader silently fails on an
 * SVG data URI, rendering the sized container with no background image and no
 * console error. Verified — the icons simply vanished. Not react-native-svg
 * either, which is not currently a dependency and would be a whole renderer
 * added to draw four shapes.
 *
 * Stroked rather than filled so the weight matches the labels beneath them, and
 * so a single `color` argument tints the whole icon.
 */

export type TabIconName = 'home' | 'search' | 'explore' | 'ask' | 'settings';

// 24x24 viewBox. Kept deliberately simple: these are read at 22pt, where extra
// detail is invisible and only costs bytes.
const PATHS: Record<TabIconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20.5 20.5 16 16',
  explore: 'M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3zM9 3v15M15 6v15',
  ask: 'M21 11.5a8 8 0 0 1-8 8H8l-5 3 1.5-4.5a8 8 0 1 1 16.5-6.5z',
  settings:
    'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L14.9 3h-4l-.4 2.9a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.9h4l.4-2.9a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
};

function toDataUri(path: string, color: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${path}"/></svg>`;
  // encodeURIComponent rather than base64: the markup stays readable in devtools
  // and it avoids pulling in a base64 shim for a string this small.
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type TabIconProps = {
  name: TabIconName;
  color: string;
  size?: number;
};

export function TabIcon({ name, color, size = 22 }: TabIconProps) {
  return (
    <img
      src={toDataUri(PATHS[name], color)}
      width={size}
      height={size}
      // Empty alt plus aria-hidden: the label beside every icon already names
      // the tab, so announcing the icon too would read each one twice.
      alt=""
      aria-hidden="true"
      style={{ display: 'block' }}
    />
  );
}
