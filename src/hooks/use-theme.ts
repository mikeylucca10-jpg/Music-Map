import { Colors } from '@/constants/theme';

// The app is dark-only by design (Colors.light and Colors.dark share one
// palette — see theme.ts), so there's no system color scheme to resolve.
export function useTheme() {
  return Colors.dark;
}
